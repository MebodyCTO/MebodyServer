package com.mebody.billing.dto;

import java.time.OffsetDateTime;

public record SubscriptionStateDto(
    String planCode,
    String status,
    OffsetDateTime currentPeriodEnd,
    boolean cancelAtPeriodEnd
) {}
