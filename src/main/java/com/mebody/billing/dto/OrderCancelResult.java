package com.mebody.billing.dto;

import java.util.UUID;

public record OrderCancelResult(
    UUID orderId,
    /** 주문에 썼다가 돌려받은 적립금 */
    int refunded,
    /** 취소로 회수된 구매 적립(5%) */
    int clawedBack,
    int balance,
    /** false 면 이미 취소된 주문이었습니다(재시도) */
    boolean changed
) {}
