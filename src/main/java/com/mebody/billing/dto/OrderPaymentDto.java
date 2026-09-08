package com.mebody.billing.dto;

import java.util.UUID;

public record OrderPaymentDto(
    UUID orderId,
    String status,
    int totalKrw,
    String provider,
    /** 이번 요청으로 실제 상태가 바뀌었는지. false 면 이미 결제된 주문이었습니다(재시도) */
    boolean changed
) {}
