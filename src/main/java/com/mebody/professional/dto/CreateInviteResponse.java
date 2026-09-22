package com.mebody.professional.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 초대 생성 결과. 토큰 원문은 이때 한 번만 내려갑니다. */
public record CreateInviteResponse(
    UUID relationId,
    String inviteUrl,
    OffsetDateTime expiresAt
) {
}
