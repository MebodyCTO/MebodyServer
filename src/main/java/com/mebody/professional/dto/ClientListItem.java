package com.mebody.professional.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 고객 목록 한 줄.
 *
 * <p>{@code inviteUrl} 은 아직 수락하지 않은 초대에만 들어갑니다. 이미 수락한 관계에서
 * 토큰을 계속 돌려주면, 콘솔 화면을 본 사람이 그 링크로 다른 계정을 묶을 수 있습니다.
 *
 * <p>{@code bodyCode} 는 고객이 동의했을 때만 채웁니다. 동의 전에는 "결과가 있는지" 조차
 * 알려주지 않습니다 — 그것도 그 사람에 대한 정보입니다.
 */
public record ClientListItem(
    UUID relationId,
    UUID clientUserId,
    String displayName,
    String status,
    OffsetDateTime invitedAt,
    OffsetDateTime consentedAt,
    OffsetDateTime expiresAt,
    boolean expired,
    String inviteUrl,
    String bodyCode
) {
}
