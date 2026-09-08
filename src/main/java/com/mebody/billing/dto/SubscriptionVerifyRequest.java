package com.mebody.billing.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 구독 결제 검증 요청.
 * <b>금액은 받지 않습니다</b> — 서버가 membership_plans 에서 직접 읽습니다.
 */
public record SubscriptionVerifyRequest(
    @NotBlank String planCode,
    @NotBlank String purchaseToken
) {}
