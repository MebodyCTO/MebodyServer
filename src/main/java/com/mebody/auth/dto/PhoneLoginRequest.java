package com.mebody.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** 번호로 로그인. identifier 에 휴대폰 번호를 보냅니다. */
public record PhoneLoginRequest(
    @NotBlank String identifier,
    @NotBlank String password
) {
}
