package com.mebody.billing.service;

import com.mebody.billing.config.BillingProperties;
import com.mebody.billing.dto.BillingConfigResponse;
import com.mebody.billing.dto.OrderCancelResult;
import com.mebody.billing.dto.OrderPaymentDto;
import com.mebody.billing.dto.SubscriptionStateDto;
import com.mebody.billing.gateway.PaymentApproval;
import com.mebody.billing.gateway.PaymentGateway;
import com.mebody.billing.gateway.PaymentGatewayRegistry;
import com.mebody.common.exception.ApiException;
import com.mebody.common.exception.NotFoundException;
import com.mebody.common.security.CurrentUser;
import com.mebody.common.security.CurrentUserService;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 결제 처리 — <b>앱에서 결제하고, 상태 변경은 여기서만 합니다.</b>
 *
 * <p>앱은 user_subscriptions 와 orders.status 를 바꿀 수 없습니다(SELECT 권한만).
 * 040 의 *_admin 함수도 authenticated 에서 EXECUTE 를 회수했으므로 PostgREST 로도 못 부릅니다.
 * 이 서비스가 유일한 통로입니다.
 *
 * <p>지켜야 하는 규칙 셋:
 * <ol>
 *   <li><b>금액은 서버가 정한다.</b> 플랜 가격은 membership_plans, 주문 금액은 orders.total_krw
 *       에서 읽습니다. 요청 본문에 금액 필드 자체를 두지 않았습니다.</li>
 *   <li><b>영수증을 먼저 검증한다.</b> 게이트웨이가 승인해야 DB 를 건드립니다.</li>
 *   <li><b>같은 결제는 한 번만 반영한다.</b> payments 의 UNIQUE(provider, txn) 로 보장합니다.</li>
 * </ol>
 */
@Service
public class BillingService {
  private final JdbcTemplate jdbc;
  private final CurrentUserService currentUserService;
  private final PaymentGatewayRegistry registry;
  private final BillingProperties properties;

  public BillingService(
      JdbcTemplate jdbc,
      CurrentUserService currentUserService,
      PaymentGatewayRegistry registry,
      BillingProperties properties) {
    this.jdbc = jdbc;
    this.currentUserService = currentUserService;
    this.registry = registry;
    this.properties = properties;
  }

  public BillingConfigResponse config() {
    PaymentGateway subscription = registry.subscriptionGateway();
    PaymentGateway order = registry.orderGateway();
    return new BillingConfigResponse(
        subscription == null ? null : subscription.provider(),
        order == null ? null : order.provider(),
        properties.devMode());
  }

  // ---------------------------------------------------------------- 구독

  @Transactional
  public SubscriptionStateDto verifySubscription(String planCode, String purchaseToken) {
    UUID user = requireAuthUserId();
    PaymentGateway gateway = registry.requireSubscriptionGateway();

    // 가격은 DB 가 정한다. 요청에는 금액 필드가 없다.
    Integer priceKrw = queryOptionalInt(
        "SELECT price_krw FROM public.membership_plans WHERE code = ? AND is_active", planCode);
    if (priceKrw == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "이용할 수 없는 멤버십 플랜입니다.");
    }

    PaymentApproval approval = gateway.verifySubscription(purchaseToken, planCode, priceKrw);
    if (approval.amountKrw() != priceKrw) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "결제 금액이 플랜 가격과 다릅니다. (" + approval.amountKrw() + " ≠ " + priceKrw + ")");
    }

    jdbc.queryForMap(
        "SELECT * FROM public.record_payment_admin(?::uuid, ?, ?, 'subscription', ?, NULL, ?, ?::jsonb)",
        user, approval.provider(), approval.txnId(), approval.amountKrw(), planCode, approval.raw());

    jdbc.queryForMap("SELECT * FROM public.activate_subscription_admin(?::uuid, ?, ?)",
        user, planCode, properties.subscriptionDaysOrDefault());

    return subscriptionState(user);
  }

  @Transactional
  public SubscriptionStateDto cancelSubscription(boolean immediate) {
    UUID user = requireAuthUserId();
    try {
      jdbc.queryForMap("SELECT * FROM public.cancel_subscription_admin(?::uuid, ?)", user, immediate);
    } catch (org.springframework.dao.DataAccessException e) {
      if (String.valueOf(e.getMostSpecificCause().getMessage()).contains("subscription not found")) {
        throw new NotFoundException("이용 중인 멤버십이 없습니다.");
      }
      throw e;
    }
    return subscriptionState(user);
  }

  // ---------------------------------------------------------------- 주문

  @Transactional
  public OrderPaymentDto confirmOrder(UUID orderId, String paymentKey) {
    UUID user = requireAuthUserId();
    PaymentGateway gateway = registry.requireOrderGateway();

    Map<String, Object> order;
    try {
      order = jdbc.queryForMap(
          "SELECT user_id, status, total_krw FROM public.orders WHERE id = ?::uuid", orderId);
    } catch (EmptyResultDataAccessException e) {
      throw new NotFoundException("주문을 찾을 수 없습니다.");
    }

    // 남의 주문을 결제 완료로 만들 수 없다.
    if (!user.equals(order.get("user_id"))) {
      throw new ApiException(HttpStatus.FORBIDDEN, "내 주문만 결제할 수 있습니다.");
    }

    String status = String.valueOf(order.get("status"));
    int total = ((Number) order.get("total_krw")).intValue();

    if ("CANCELED".equals(status) || "FAILED".equals(status)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "이미 취소된 주문입니다.");
    }

    // 금액은 여기서 정한다. 클라이언트가 보낸 값을 쓰지 않는다.
    PaymentApproval approval = gateway.confirmOrderPayment(paymentKey, total);
    if (approval.amountKrw() != total) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "결제 금액이 주문 금액과 다릅니다. (" + approval.amountKrw() + " ≠ " + total + ")");
    }

    Map<String, Object> payment = jdbc.queryForMap(
        "SELECT * FROM public.record_payment_admin(?::uuid, ?, ?, 'order', ?, ?::uuid, NULL, ?::jsonb)",
        user, approval.provider(), approval.txnId(), approval.amountKrw(), orderId, approval.raw());

    Map<String, Object> paid = jdbc.queryForMap("SELECT * FROM public.mark_order_paid_admin(?::uuid, ?::uuid)",
        orderId, payment.get("payment_id"));

    return new OrderPaymentDto(
        orderId,
        String.valueOf(paid.get("status")),
        ((Number) paid.get("total_krw")).intValue(),
        approval.provider(),
        Boolean.TRUE.equals(paid.get("was_new")));
  }

  /**
   * 결제 완료 주문 취소.
   *
   * <p>결제사 환불이 먼저입니다 — 돈을 돌려주지 못했는데 주문만 취소하면
   * 우리 장부와 결제사 장부가 어긋납니다. 환불이 성공한 뒤에 DB 를 정리합니다.
   * 배송이 시작된 뒤에는 DB 함수가 거절합니다(그건 반품이고 다른 절차입니다).
   */
  @Transactional
  public OrderCancelResult cancelOrder(UUID orderId, String reason) {
    UUID user = requireAuthUserId();

    Map<String, Object> order;
    try {
      order = jdbc.queryForMap(
          "SELECT user_id, status, total_krw, fulfillment_status FROM public.orders WHERE id = ?::uuid", orderId);
    } catch (EmptyResultDataAccessException e) {
      throw new NotFoundException("주문을 찾을 수 없습니다.");
    } catch (org.springframework.dao.DataAccessException e) {
      // 042 미적용 환경에서 "서버 처리 중 오류" 만 뜨면 무엇이 문제인지 알 수 없습니다.
      if (String.valueOf(e.getMostSpecificCause().getMessage()).contains("fulfillment_status")) {
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
            "주문 취소에 필요한 DB 변경이 아직 적용되지 않았습니다. db/journey/042_fulfillment_and_ssv.sql 을 실행해주세요.");
      }
      throw e;
    }
    if (!user.equals(order.get("user_id"))) {
      throw new ApiException(HttpStatus.FORBIDDEN, "내 주문만 취소할 수 있습니다.");
    }

    String status = String.valueOf(order.get("status"));
    String fulfillment = String.valueOf(order.get("fulfillment_status"));
    if ("PAID".equals(status) && !("NONE".equals(fulfillment) || "PREPARING".equals(fulfillment))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "이미 발송된 주문은 취소할 수 없습니다. 반품으로 처리해주세요.");
    }

    // 결제 전 주문은 결제사에 돌려줄 것이 없습니다.
    if ("PAID".equals(status)) {
      refundThroughGateway(orderId, ((Number) order.get("total_krw")).intValue());
    }

    Map<String, Object> result;
    try {
      result = jdbc.queryForMap("SELECT * FROM public.cancel_paid_order_admin(?::uuid, ?::uuid, ?)",
          orderId, user, reason);
    } catch (org.springframework.dao.DataAccessException e) {
      String message = String.valueOf(e.getMostSpecificCause().getMessage());
      if (message.contains("already shipped")) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "이미 발송된 주문은 취소할 수 없습니다.");
      }
      if (message.contains("cannot be canceled here")) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "이 주문은 취소할 수 없는 상태입니다.");
      }
      throw e;
    }

    return new OrderCancelResult(
        orderId,
        ((Number) result.get("refunded")).intValue(),
        ((Number) result.get("clawed_back")).intValue(),
        ((Number) result.get("balance")).intValue(),
        Boolean.TRUE.equals(result.get("was_new")));
  }

  /**
   * 결제사 환불. 개발 어댑터는 바로 성공하고, 실제 PG 는 아직 붙지 않아 501 을 던집니다.
   * 501 이 나면 취소 자체가 멈춥니다 — 돈을 못 돌려주는데 주문만 지우면 안 되기 때문입니다.
   */
  private void refundThroughGateway(UUID orderId, int amountKrw) {
    PaymentGateway gateway = registry.requireOrderGateway();
    gateway.refundOrderPayment("order:" + orderId, amountKrw);
  }

  // ---------------------------------------------------------------- 내부

  /**
   * 결제 관련 테이블(orders / user_subscriptions / payments)의 user_id 는 전부
   * auth.users(id) 를 가리킵니다. user_profiles.id 와 같은 값인 계정이 많지만
   * 보장되지 않으므로 <b>반드시 auth user id 를 씁니다.</b>
   */
  private UUID requireAuthUserId() {
    CurrentUser user = currentUserService.requireCurrentUser();
    if (user.authUserId() == null) {
      throw new ApiException(HttpStatus.FORBIDDEN, "인증 계정을 확인할 수 없습니다.");
    }
    return user.authUserId();
  }

  private SubscriptionStateDto subscriptionState(UUID user) {
    try {
      Map<String, Object> row = jdbc.queryForMap(
          "SELECT plan_code, status, current_period_end, cancel_at_period_end"
              + " FROM public.user_subscriptions WHERE user_id = ?::uuid", user);
      return new SubscriptionStateDto(
          (String) row.get("plan_code"),
          (String) row.get("status"),
          row.get("current_period_end") == null
              ? null
              : ((java.sql.Timestamp) row.get("current_period_end")).toInstant().atOffset(OffsetDateTime.now().getOffset()),
          Boolean.TRUE.equals(row.get("cancel_at_period_end")));
    } catch (EmptyResultDataAccessException e) {
      return null;
    }
  }

  private Integer queryOptionalInt(String sql, Object... args) {
    try {
      return jdbc.queryForObject(sql, Integer.class, args);
    } catch (EmptyResultDataAccessException e) {
      return null;
    }
  }
}
