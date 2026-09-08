package com.mebody.billing.gateway;

import com.mebody.common.exception.ApiException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 지금 쓸 수 있는 결제 어댑터를 고릅니다.
 *
 * <p>우선순위는 <b>실결제 우선</b>입니다 — 계약이 끝나 실제 어댑터가 설정되면
 * 개발 어댑터는 자동으로 밀려납니다. 개발 어댑터를 끄는 걸 잊어도 실결제가 우선입니다.
 */
@Component
public class PaymentGatewayRegistry {
  private final List<PaymentGateway> gateways;

  public PaymentGatewayRegistry(List<PaymentGateway> gateways) {
    this.gateways = gateways;
  }

  /** 구독용. 없으면 null (앱은 결제 버튼을 잠급니다) */
  public PaymentGateway subscriptionGateway() {
    return pick(PaymentGateway::supportsSubscription);
  }

  /** 실물 주문용. 없으면 null */
  public PaymentGateway orderGateway() {
    return pick(PaymentGateway::supportsOrder);
  }

  public PaymentGateway requireSubscriptionGateway() {
    return require(subscriptionGateway(), "구독 결제 수단이 아직 연결되지 않았습니다.");
  }

  public PaymentGateway requireOrderGateway() {
    return require(orderGateway(), "상품 결제 수단이 아직 연결되지 않았습니다.");
  }

  private PaymentGateway pick(java.util.function.Predicate<PaymentGateway> supports) {
    PaymentGateway dev = null;
    for (PaymentGateway gateway : gateways) {
      if (!supports.test(gateway)) continue;
      if ("dev".equals(gateway.provider())) {
        dev = gateway;
        continue;
      }
      return gateway;
    }
    return dev;
  }

  private PaymentGateway require(PaymentGateway gateway, String message) {
    if (gateway == null) {
      throw new ApiException(HttpStatus.NOT_IMPLEMENTED, message);
    }
    return gateway;
  }
}
