package com.mebody.order.service;

import com.mebody.common.exception.ApiException;
import com.mebody.common.exception.NotFoundException;
import com.mebody.common.security.CurrentUserService;
import com.mebody.order.dto.AdminOrderDto;
import com.mebody.user.domain.UserRole;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자·판매자 콘솔의 주문 관리.
 *
 * <p>배송 상태는 앱이 바꿀 수 없습니다(042 에서 authenticated 의 EXECUTE 를 회수했습니다).
 * 여기가 유일한 통로입니다.
 *
 * <p>판매자는 <b>자기 상품이 든 주문만</b> 봅니다. 남의 주문을 보거나 배송 상태를
 * 건드릴 수 없습니다.
 */
@Service
public class AdminOrderService {
  private final JdbcTemplate jdbc;
  private final CurrentUserService currentUserService;

  public AdminOrderService(JdbcTemplate jdbc, CurrentUserService currentUserService) {
    this.jdbc = jdbc;
    this.currentUserService = currentUserService;
  }

  @Transactional(readOnly = true)
  public List<AdminOrderDto> list(String statusFilter) {
    var user = currentUserService.requireRole(UserRole.ADMIN, UserRole.SELLER);
    boolean sellerScope = user.role() == UserRole.SELLER;

    StringBuilder sql = new StringBuilder("""
        SELECT o.id, o.status, o.fulfillment_status, o.subtotal_krw, o.reward_used, o.total_krw,
               o.tracking_carrier, o.tracking_no, o.paid_at, o.created_at, o.shipping_snapshot,
               p.email AS buyer_email,
               (SELECT string_agg(oi.name || ' x' || oi.quantity, ', ')
                  FROM public.order_items oi WHERE oi.order_id = o.id) AS item_summary
          FROM public.orders o
          LEFT JOIN public.user_profiles p ON p.id = o.user_id OR p.auth_user_id = o.user_id
         WHERE o.status <> 'PENDING'
        """);
    List<Object> args = new ArrayList<>();

    if (sellerScope) {
      // 내 상품이 하나라도 들어 있는 주문만.
      sql.append(" AND EXISTS (SELECT 1 FROM public.order_items oi"
          + " JOIN public.products pr ON pr.id = oi.product_id"
          + " WHERE oi.order_id = o.id AND pr.seller_id = ?::uuid)");
      args.add(user.id());
    }
    if (statusFilter != null && !statusFilter.isBlank()) {
      sql.append(" AND o.fulfillment_status = ?");
      args.add(statusFilter);
    }
    sql.append(" ORDER BY o.created_at DESC LIMIT 200");

    try {
      return queryOrders(sql.toString(), args);
    } catch (org.springframework.dao.DataAccessException e) {
      throw translate(e);
    }
  }

  /**
   * 042 가 아직 적용되지 않은 환경에서 "서버 처리 중 오류" 만 뜨면 운영자가 원인을 알 수 없습니다.
   * 무엇을 해야 하는지 문장으로 알려줍니다.
   */
  private RuntimeException translate(org.springframework.dao.DataAccessException e) {
    String message = String.valueOf(e.getMostSpecificCause().getMessage());
    if (message.contains("fulfillment_status") || message.contains("shipping_snapshot")
        || message.contains("set_order_fulfillment_admin")) {
      return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
          "배송 관리에 필요한 DB 변경이 아직 적용되지 않았습니다. db/journey/042_fulfillment_and_ssv.sql 을 실행해주세요.");
    }
    return e;
  }

  private List<AdminOrderDto> queryOrders(String sql, List<Object> args) {
    return jdbc.query(sql, (rs, rowNum) -> new AdminOrderDto(
        UUID.fromString(rs.getString("id")),
        rs.getString("buyer_email"),
        rs.getString("status"),
        rs.getString("fulfillment_status"),
        rs.getInt("subtotal_krw"),
        rs.getInt("reward_used"),
        rs.getInt("total_krw"),
        rs.getString("tracking_carrier"),
        rs.getString("tracking_no"),
        toOffset(rs.getTimestamp("paid_at")),
        toOffset(rs.getTimestamp("created_at")),
        rs.getString("shipping_snapshot"),
        rs.getString("item_summary") == null ? List.of() : List.of(rs.getString("item_summary"))
    ), args.toArray());
  }

  @Transactional
  public AdminOrderDto setFulfillment(UUID orderId, String status, String carrier, String trackingNo) {
    var user = currentUserService.requireRole(UserRole.ADMIN, UserRole.SELLER);

    if (user.role() == UserRole.SELLER) {
      Integer mine = jdbc.queryForObject(
          "SELECT count(*) FROM public.order_items oi JOIN public.products pr ON pr.id = oi.product_id"
              + " WHERE oi.order_id = ?::uuid AND pr.seller_id = ?::uuid",
          Integer.class, orderId, user.id());
      if (mine == null || mine == 0) {
        throw new ApiException(HttpStatus.FORBIDDEN, "내 상품이 포함된 주문만 처리할 수 있습니다.");
      }
    }

    try {
      jdbc.queryForMap("SELECT * FROM public.set_order_fulfillment_admin(?::uuid, ?, ?, ?)",
          orderId, status, carrier, trackingNo);
    } catch (org.springframework.dao.EmptyResultDataAccessException e) {
      throw new NotFoundException("주문을 찾을 수 없습니다.");
    } catch (org.springframework.dao.DataAccessException e) {
      String message = String.valueOf(e.getMostSpecificCause().getMessage());
      if (message.contains("fulfillment_status") || message.contains("set_order_fulfillment_admin")) {
        throw translate(e);
      }
      if (message.contains("tracking number required")) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "발송 처리에는 송장번호가 필요합니다.");
      }
      if (message.contains("cannot go backwards")) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "배송 상태는 되돌릴 수 없습니다.");
      }
      if (message.contains("only paid orders")) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "결제가 완료된 주문만 배송할 수 있습니다.");
      }
      if (message.contains("unknown fulfillment status")) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "알 수 없는 배송 상태입니다.");
      }
      if (message.contains("order not found")) {
        throw new NotFoundException("주문을 찾을 수 없습니다.");
      }
      throw e;
    }

    return list(null).stream()
        .filter(o -> o.id().equals(orderId))
        .findFirst()
        .orElseThrow(() -> new NotFoundException("주문을 찾을 수 없습니다."));
  }

  private OffsetDateTime toOffset(Timestamp value) {
    return value == null ? null : value.toInstant().atOffset(OffsetDateTime.now().getOffset());
  }
}
