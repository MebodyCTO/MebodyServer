package com.mebody.billing.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 주문 결제 승인 요청.
 * <b>금액은 받지 않습니다</b> — 서버가 orders.total_krw 에서 직접 읽습니다.
 * 클라이언트가 보낸 금액을 믿으면 100원으로 5만원짜리를 살 수 있습니다.
 */
public record OrderConfirmRequest(@NotBlank String paymentKey) {}
