package com.mebody.billing.gateway;

import com.mebody.billing.config.BillingProperties;
import jakarta.annotation.PostConstruct;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 개발용 결제 어댑터 — <b>돈이 오가지 않습니다.</b>
 *
 * <p>사업자등록·PG/스토어 계약 전에 앱의 결제 플로우(담기 → 주문 → 결제 → 적립 → 내역)를
 * 끝까지 돌려보기 위한 것입니다. 켜져 있으면 누구나 공짜로 멤버십을 켤 수 있으므로
 * <b>운영에서는 절대 켜면 안 됩니다.</b>
 *
 * <p>{@code mebody.billing.dev-mode=true} 일 때만 빈으로 등록됩니다(기본 false).
 */
@Component
@ConditionalOnProperty(prefix = "mebody.billing", name = "dev-mode", havingValue = "true")
public class DevPaymentGateway implements PaymentGateway {
  private static final Logger log = LoggerFactory.getLogger(DevPaymentGateway.class);

  private final BillingProperties properties;

  public DevPaymentGateway(BillingProperties properties) {
    this.properties = properties;
  }

  @PostConstruct
  void warn() {
    log.warn("");
    log.warn("  ############################################################");
    log.warn("  #  개발용 결제 어댑터가 켜져 있습니다 (mebody.billing.dev-mode=true)");
    log.warn("  #  실제 결제 없이 멤버십이 활성화되고 주문이 결제 완료가 됩니다.");
    log.warn("  #  운영 환경이라면 지금 끄세요.");
    log.warn("  ############################################################");
    log.warn("");
  }

  @Override
  public String provider() {
    return "dev";
  }

  @Override
  public boolean supportsSubscription() {
    return true;
  }

  @Override
  public boolean supportsOrder() {
    return true;
  }

  @Override
  public PaymentApproval verifySubscription(String token, String planCode, int expectedKrw) {
    return approve(token, expectedKrw, "subscription:" + planCode);
  }

  @Override
  public PaymentApproval confirmOrderPayment(String paymentKey, int expectedKrw) {
    return approve(paymentKey, expectedKrw, "order");
  }

  @Override
  public PaymentApproval refundOrderPayment(String reference, int amountKrw) {
    return approve("refund-" + reference, amountKrw, "refund");
  }

  /**
   * 토큰을 그대로 거래 ID 로 씁니다. 앱이 같은 토큰으로 두 번 부르면
   * payments 의 UNIQUE 가 잡아내므로 멱등성도 함께 확인할 수 있습니다.
   */
  private PaymentApproval approve(String token, int expectedKrw, String memo) {
    String txn = token == null || token.isBlank() ? "dev-" + UUID.randomUUID() : "dev-" + token;
    return new PaymentApproval(
        provider(),
        txn,
        expectedKrw,
        "{\"gateway\":\"dev\",\"memo\":\"" + memo + "\",\"devMode\":" + properties.devMode() + "}");
  }
}
