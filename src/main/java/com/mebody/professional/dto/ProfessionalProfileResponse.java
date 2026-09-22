package com.mebody.professional.dto;

import java.util.UUID;

/** 콘솔 상단에 보여줄 "나는 누구인가". */
public record ProfessionalProfileResponse(
    UUID professionalId,
    String type,
    String displayName,
    String status
) {
}
