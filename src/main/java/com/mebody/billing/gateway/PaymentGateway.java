package com.mebody.billing.gateway;

/**
 * 결제 수단 어댑터.
 *
 * <p>정책상 두 갈래로 나뉩니다:
 * <ul>
 *   <li><b>멤버십(디지털 구독)</b> — 앱 안에서 소비되므로 Google Play 결제를 씁니다.</li>
 *   <li><b>마켓 상품(실물 배송)</b> — Play 결제가 <b>금지</b>이고 PG(토스페이먼츠 등)를 써야 합니다.</li>
 * </ul>
 * 그래서 구독용 게이트웨이와 주문용 게이트웨이를 따로 고릅니다.
 * 지금은 둘 다 계약 전이라 개발 어댑터가 자리를 지킵니다.
 */
public interface PaymentGateway {
  /** payments.provider 에 기록될 이름 */
  String provider();

  /** 구독 결제를 처리할 수 있는가 */
  default boolean supportsSubscription() { return false; }

  /** 실물 상품 주문 결제를 처리할 수 있는가 */
  default boolean supportsOrder() { return false; }

  /**
   * 스토어 영수증을 검증합니다.
   *
   * @param token       앱이 받은 구매 토큰
   * @param planCode    멤버십 플랜 코드
   * @param expectedKrw 서버가 DB 에서 읽은 플랜 가격
   */
  PaymentApproval verifySubscription(String token, String planCode, int expectedKrw);

  /**
   * PG 결제를 승인합니다.
   *
   * @param paymentKey  PG 가 준 결제 키
   * @param expectedKrw <b>서버가 orders.total_krw 에서 읽은</b> 금액. 클라이언트 값이 아닙니다
   */
  PaymentApproval confirmOrderPayment(String paymentKey, int expectedKrw);

  /**
   * 결제를 취소(환불)합니다.
   *
   * <p>실패하면 예외를 던져야 합니다. 돈을 돌려주지 못했는데 주문만 취소되면
   * 우리 장부와 결제사 장부가 어긋납니다.
   */
  default PaymentApproval refundOrderPayment(String reference, int amountKrw) {
    throw new UnsupportedOperationException("refund not supported by " + provider());
  }
}
