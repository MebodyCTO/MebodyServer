package com.mebody.professional.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 관리자가 전문가 계정을 발급할 때 보내는 값.
 *
 * <p>이메일은 **이미 가입된 계정**이어야 합니다. 여기서 계정을 새로 만들지 않습니다.
 * 전문가 승인은 사람이 하는 일이고, 만드는 일까지 겸하면 "승인" 이 자동화됩니다.
 */
public record IssueProfessionalRequest(
    @NotBlank String email,
    @NotBlank String type,
    String displayName
) {
}
