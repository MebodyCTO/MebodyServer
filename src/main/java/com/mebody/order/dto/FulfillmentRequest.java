package com.mebody.order.dto;

import jakarta.validation.constraints.NotBlank;

/** 배송 상태 변경 요청. 발송(SHIPPED) 이상은 송장이 있어야 합니다. */
public record FulfillmentRequest(
    @NotBlank String status,
    String carrier,
    String trackingNo
) {}
