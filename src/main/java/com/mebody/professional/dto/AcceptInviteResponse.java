package com.mebody.professional.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 고객이 동의한 결과. */
public record AcceptInviteResponse(
    UUID relationId,
    String professionalName,
    OffsetDateTime consentedAt,
    boolean hasResult
) {
}
