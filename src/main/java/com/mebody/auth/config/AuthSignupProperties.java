package com.mebody.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 회원가입 확인 절차 스위치.
 *
 * <p>지금은 이메일·휴대폰 둘 다 <b>가입 즉시 이용</b>입니다. 확인 절차 코드는 만들어 두었고
 * 아래 값만 바꾸면 바로 켜집니다. 앱 코드는 손대지 않아도 됩니다.
 *
 * <p><b>이메일 확인을 켤 때</b>
 * {@code MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=true}. Supabase 프로젝트의 Confirm email 이
 * 이미 켜져 있으므로(실측 확인) 이 값만 바꾸면 확인 메일이 나가고, 확인 전에는 로그인이 막힙니다.
 *
 * <p><b>휴대폰 인증을 켤 때</b>는 준비가 하나 더 필요합니다. Supabase 의 전화 제공자가 꺼져 있어서
 * 지금은 휴대폰 가입도 로그인도 Supabase 가 거부합니다(실측: {@code phone_provider_disabled}).
 * 그래서 휴대폰 가입을 이메일 별칭({@code 01012345678@phone.mebody.net})으로 처리합니다.
 * Twilio 같은 SMS 제공자를 Supabase 에 연결한 뒤
 * {@code MEBODY_AUTH_PHONE_MODE=native} 로 바꾸면 번호 자체로 가입·로그인하게 됩니다.
 */
@ConfigurationProperties(prefix = "mebody.auth")
public record AuthSignupProperties(
    Boolean requireEmailVerification,
    Boolean requirePhoneVerification,
    String phoneMode,
    String phoneAliasDomain,
    Integer minPasswordLength
) {
  /**
   * 비밀번호 최소 길이. 기본 1 — 사실상 제한이 없습니다.
   *
   * <p>Supabase 는 관리자 생성 경로에서 길이를 보지 않습니다(실측: 1자도 생성·로그인 됨).
   * 그래서 지금 걸려 있는 제한은 전부 우리가 건 것이고, 값 하나로 다시 올릴 수 있습니다.
   * 예: {@code MEBODY_AUTH_MIN_PASSWORD_LENGTH=8}
   */
  public int minPasswordLengthOrDefault() {
    return minPasswordLength == null || minPasswordLength < 1 ? 1 : minPasswordLength;
  }
  /** 이메일 가입에 확인 메일을 요구할지. 기본은 요구하지 않음(가입 즉시 이용). */
  public boolean emailVerificationRequired() {
    return Boolean.TRUE.equals(requireEmailVerification);
  }

  /** 휴대폰 가입에 인증번호를 요구할지. 기본은 요구하지 않음. */
  public boolean phoneVerificationRequired() {
    return Boolean.TRUE.equals(requirePhoneVerification);
  }

  /** alias: 이메일 별칭으로 처리(지금) / native: Supabase 전화 제공자 사용(제공자 연결 후). */
  public boolean phoneNativeMode() {
    return "native".equalsIgnoreCase(phoneMode == null ? "" : phoneMode.trim());
  }

  /**
   * 별칭 이메일의 도메인. 실제로 메일을 받지 않는 주소이므로 확인 메일을 보내지 않습니다.
   * 앱의 {@code VITE_PHONE_ALIAS_DOMAIN} 과 반드시 같아야 합니다. 로그인할 때 앱이 같은 규칙으로
   * 번호를 별칭으로 바꿔 보내기 때문입니다.
   */
  public String aliasDomain() {
    return phoneAliasDomain == null || phoneAliasDomain.isBlank()
        ? "phone.mebody.net"
        : phoneAliasDomain.trim().toLowerCase();
  }
}
