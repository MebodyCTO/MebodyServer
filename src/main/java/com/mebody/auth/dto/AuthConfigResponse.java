package com.mebody.auth.dto;

/**
 * 앱이 회원가입 화면을 그리기 전에 물어보는 값.
 *
 * <p>{@code phoneAliasDomain} 이 중요합니다. 휴대폰으로 가입한 사람이 다시 로그인할 때
 * 앱이 번호를 같은 규칙으로 별칭 이메일로 바꿔야 하기 때문입니다.
 * 서버에 못 붙는 상황에서는 앱이 자기 기본값을 씁니다. 둘은 같아야 합니다.
 */
public record AuthConfigResponse(
    boolean emailVerificationRequired,
    boolean phoneVerificationRequired,
    String phoneMode,
    String phoneAliasDomain,
    int minPasswordLength
) {
}
