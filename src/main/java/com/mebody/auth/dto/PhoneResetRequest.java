package com.mebody.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 번호로 비밀번호 재설정 요청.
 *
 * @param redirectTo 재설정 링크를 눌렀을 때 돌아올 주소. 비우면 Supabase 기본값입니다.
 */
public record PhoneResetRequest(
    @NotBlank String identifier,
    String redirectTo
) {
}
