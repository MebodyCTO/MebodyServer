package com.mebody.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 회원가입 확인 절차 스위치.
 *
 * <p><b>2026-09-21 부터 이메일 확인은 ON, 휴대폰은 OFF 입니다.</b>
 * 되돌리려면 {@code MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=false} 하나만 주면 됩니다.
 * 앱 코드는 손대지 않아도 됩니다.
 *
 * <p><b>이메일 확인이 켜져 있을 때</b> 가입하면 Supabase 가 확인 메일을 보내고
 * ({@code mailer_autoconfirm=false} 실측 확인), 링크를 열기 전에는 로그인이 막힙니다.
 * 공개 승인 경로({@code /api/public/auth/approve})는 이때 409 로 거절합니다 — 그쪽으로 풀리면
 * 확인 절차를 켠 의미가 없기 때문입니다.
 *
 * <p><b>전제</b>: 확인 메일이 실제로 도착해야 합니다. Supabase 기본 SMTP 는 시간당 몇 통으로
 * 제한되고 프로젝트에 따라 팀 멤버 주소로만 나갑니다. 외부 가입자를 받기 전에
 * Authentication → Emails 에서 자체 SMTP 를 붙이세요. 확인 링크가 돌아올 주소는
 * {@code mebody.app-url} 이며, Supabase 의 Redirect URLs 허용 목록에 있어야 합니다.
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
    Integer minPasswordLength,
    Boolean phoneSignupEnabled,
    Boolean requirePhoneRecoveryEmail
) {
  /** 출시 기준 최소 길이. 값을 주지 않으면 이 값이 쓰입니다. */
  private static final int DEFAULT_MIN_PASSWORD_LENGTH = 8;

  /**
   * 비밀번호 최소 길이. <b>기본 8자입니다.</b>
   *
   * <p>2026-09-22 감사까지는 기본 1자였습니다. Supabase 는 관리자 생성 경로에서 길이를 보지 않으므로
   * (실측: 1자도 생성·로그인 됨) 제한은 전부 우리가 거는 것이고, 1자면 사실상 제한이 없었습니다.
   *
   * <p><b>이 값은 가입과 비밀번호 재설정에만 걸립니다.</b> 로그인에는 걸지 않습니다 —
   * 걸면 기준을 올린 순간 기존 짧은 비밀번호 계정이 전부 잠깁니다. 그 사람들은 다음 재설정에서
   * 새 기준을 맞추게 됩니다.
   *
   * <p>되돌리려면 {@code MEBODY_AUTH_MIN_PASSWORD_LENGTH=1}. 1 미만은 1로 봅니다.
   */
  public int minPasswordLengthOrDefault() {
    if (minPasswordLength == null) return DEFAULT_MIN_PASSWORD_LENGTH;
    return minPasswordLength < 1 ? 1 : minPasswordLength;
  }

  /**
   * 휴대폰으로 가입할 수 있는지. 기본 허용.
   *
   * <p>지금 휴대폰 가입은 SMS 인증이 아니라 이메일 별칭이므로 <b>번호 소유를 증명하지 못합니다.</b>
   * 남의 번호를 먼저 적어 선점하는 것을 막을 방법이 코드에는 없습니다. 공개 모집 전에
   * SMS 제공자를 붙이거나, {@code MEBODY_AUTH_PHONE_SIGNUP_ENABLED=false} 로 이 길을 닫으세요.
   * 닫으면 앱과 홈페이지가 설정을 읽어 휴대폰 안내를 함께 감춥니다.
   */
  public boolean phoneSignupAllowed() {
    return !Boolean.FALSE.equals(phoneSignupEnabled);
  }

  /**
   * 휴대폰 가입에 복구용 이메일을 반드시 받을지. <b>기본 요구합니다.</b>
   *
   * <p>별칭 주소({@code 010…@phone.mebody.net})는 실제로 메일을 받지 못합니다. 복구용 이메일이
   * 없으면 비밀번호를 잊은 순간 <b>계정을 되찾을 방법이 아예 없습니다</b>(재설정 메일을 보낼 곳이 없음).
   * 2026-09-22 감사의 "복구 수단이 없는 휴대폰 계정 생성을 허용하지 않는다" 가 이것입니다.
   */
  public boolean phoneRecoveryEmailRequired() {
    return !Boolean.FALSE.equals(requirePhoneRecoveryEmail);
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
