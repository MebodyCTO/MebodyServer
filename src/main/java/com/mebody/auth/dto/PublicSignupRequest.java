package com.mebody.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 회원가입 요청.
 *
 * @param identifier 이메일 또는 휴대폰 번호. 어느 쪽인지는 서버가 판별합니다.
 * @param email      예전 호출부 호환용. identifier 가 비어 있을 때만 씁니다.
 */
public record PublicSignupRequest(
    String identifier,
    String email,
    // 길이 제한은 여기가 아니라 mebody.auth.min-password-length 가 정합니다.
    // 나중에 올릴 때 코드를 고치지 않아도 되게 한 곳으로 모았습니다.
    @NotBlank(message = "비밀번호를 입력해주세요.") String password,
    String displayName
) {
  public String resolvedIdentifier() {
    if (identifier != null && !identifier.isBlank()) return identifier;
    return email;
  }
}
