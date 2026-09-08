package com.mebody.billing.gateway;

import com.mebody.billing.config.BillingProperties;
import com.mebody.common.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 멤버십(디지털 구독)의 Google Play 결제 자리.
 *
 * <p><b>아직 구현하지 않았습니다.</b> Play Console 앱 등록과 서비스 계정 키가 있어야
 * 영수증을 검증할 수 있습니다.
 *
 * <p>붙일 때 할 일: Android Publisher API 의
 * {@code purchases.subscriptionsv2.get(packageName, purchaseToken)} 으로 토큰을 검증하고,
 * 응답의 상태가 활성인지, 우리 상품 ID 가 맞는지 확인한 뒤 purchaseToken 을 txnId 로 씁니다.
 * <b>앱이 보낸 토큰을 검증 없이 믿으면 안 됩니다</b> — 그러면 위조 토큰으로 멤버십이 열립니다.
 */
@Component
public class PlayBillingGateway implements PaymentGateway {
  private final BillingProperties properties;

  public PlayBillingGateway(BillingProperties properties) {
    this.properties = properties;
  }

  @Override
  public String provider() {
    return "google_play";
  }

  @Override
  public boolean supportsSubscription() {
    return properties.googlePlayConfigured();
  }

  @Override
  public PaymentApproval verifySubscription(String token, String planCode, int expectedKrw) {
    throw new ApiException(HttpStatus.NOT_IMPLEMENTED,
        "Google Play 결제 연동은 아직 준비 중입니다. Play Console 등록과 서비스 계정 키 설정 후 열립니다.");
  }

  @Override
  public PaymentApproval confirmOrderPayment(String paymentKey, int expectedKrw) {
    throw new ApiException(HttpStatus.NOT_IMPLEMENTED,
        "실물 상품은 스토어 결제를 쓸 수 없습니다(Google Play 정책). PG 결제를 사용하세요.");
  }
}
