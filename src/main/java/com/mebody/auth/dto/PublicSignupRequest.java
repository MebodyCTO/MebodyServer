package com.mebody.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 회원가입 요청.
 *
 * @param identifier 이메일 또는 휴대폰 번호. 어느 쪽인지는 서버가 판별합니다.
 * @param email         예전 호출부 호환용. identifier 가 비어 있을 때만 씁니다.
 * @param agreedTerms     이용약관 동의. 동의 시각을 남기기 위해 받습니다.
 * @param agreedPrivacy   개인정보처리방침 동의.
 * @param agreedMarketing 마케팅 수신 동의(선택).
 * @param recoveryEmail 휴대폰으로 가입할 때만 씁니다. 비밀번호를 잊었을 때 재설정 메일이 갈 곳입니다.
 *                      적으면 **이 주소가 계정의 이메일이 됩니다.** 별칭 주소로는 메일을 보낼 수 없기 때문입니다.
 */
public record PublicSignupRequest(
    String identifier,
    String email,
    String recoveryEmail,
    Boolean agreedTerms,
    Boolean agreedPrivacy,
    Boolean agreedMarketing,
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
