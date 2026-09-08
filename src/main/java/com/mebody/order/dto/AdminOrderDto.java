package com.mebody.order.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** 관리자·판매자 콘솔의 주문 한 건. */
public record AdminOrderDto(
    UUID id,
    String buyerEmail,
    String status,
    String fulfillmentStatus,
    int subtotalKrw,
    int rewardUsed,
    int totalKrw,
    String trackingCarrier,
    String trackingNo,
    OffsetDateTime paidAt,
    OffsetDateTime createdAt,
    /** 주문 시점의 배송지 사본 */
    String shipping,
    List<String> items
) {}
