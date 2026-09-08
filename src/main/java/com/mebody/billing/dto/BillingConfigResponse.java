package com.mebody.billing.dto;

/**
 * 앱이 결제 버튼을 열지 말지 판단하는 데 쓰는 값.
 * provider 가 null 이면 그 결제는 아직 불가능합니다.
 */
public record BillingConfigResponse(
    String subscriptionProvider,
    String orderProvider,
    boolean devMode
) {}
