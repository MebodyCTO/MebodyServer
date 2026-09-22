package com.mebody.professional.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 고객이 보는 "나와 연결된 전문가" 한 줄. 해지 버튼이 relationId 를 씁니다. */
public record MyProfessionalItem(
    UUID relationId,
    String professionalName,
    String professionalType,
    String status,
    OffsetDateTime consentedAt
) {
}
