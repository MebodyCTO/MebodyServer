package com.mebody.billing.gateway;

import com.mebody.billing.config.BillingProperties;
import com.mebody.common.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 실물 상품 주문의 PG 결제(토스페이먼츠) 자리.
 *
 * <p><b>아직 구현하지 않았습니다.</b> 사업자등록과 결제사 계약이 끝나야 시크릿 키가 나오고,
 * 키 없이 쓴 승인 코드는 동작을 확인할 방법이 없습니다. 확인하지 못한 코드를 "됐다" 고
 * 말하지 않기 위해 명시적으로 501 을 돌려줍니다.
 *
 * <p>붙일 때 할 일: {@code POST https://api.tosspayments.com/v1/payments/confirm} 에
 * {@code paymentKey / orderId / amount} 를 보내고, 응답의 {@code paymentKey} 를 txnId 로,
 * 응답의 {@code totalAmount} 를 amountKrw 로 넣어 {@link PaymentApproval} 을 만듭니다.
 * <b>금액은 반드시 응답 값을 쓰고</b>, expectedKrw 와 다르면 예외를 던져야 합니다.
 */
@Component
public class TossPaymentGateway implements PaymentGateway {
  private final BillingProperties properties;

  public TossPaymentGateway(BillingProperties properties) {
    this.properties = properties;
  }

  @Override
  public String provider() {
    return "toss";
  }

  @Override
  public boolean supportsOrder() {
    return properties.tossConfigured();
  }

  @Override
  public PaymentApproval verifySubscription(String token, String planCode, int expectedKrw) {
    throw new ApiException(HttpStatus.NOT_IMPLEMENTED, "구독은 PG 가 아니라 스토어 결제로 처리합니다.");
  }

  @Override
  public PaymentApproval confirmOrderPayment(String paymentKey, int expectedKrw) {
    throw new ApiException(HttpStatus.NOT_IMPLEMENTED,
        "토스페이먼츠 연동은 아직 준비 중입니다. 사업자등록과 결제사 계약 후 TOSS_SECRET_KEY 를 설정하면 열립니다.");
  }

  /**
   * 붙일 때 할 일: {@code POST /v1/payments/{paymentKey}/cancel} 에 취소 사유와 금액을 보냅니다.
   * 응답의 취소 내역을 확인하고, 실패하면 반드시 예외를 던져야 합니다.
   */
  @Override
  public PaymentApproval refundOrderPayment(String reference, int amountKrw) {
    throw new ApiException(HttpStatus.NOT_IMPLEMENTED,
        "결제 취소(환불) 연동이 아직 준비 중입니다. 지금은 주문을 취소할 수 없습니다.");
  }
}
