package com.mebody.auth.dto;

import com.mebody.common.exception.ApiException;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;

/**
 * 가입에 쓴 식별자 한 건. 이메일이거나 휴대폰 번호입니다.
 *
 * <p>휴대폰은 로그인에 쓸 별칭 이메일을 함께 들고 다닙니다. Supabase 의 전화 제공자가 꺼져 있어
 * 번호로는 로그인이 되지 않기 때문입니다. 앱도 같은 규칙으로 번호를 별칭으로 바꿔 로그인합니다.
 *
 * @param channel    email 또는 phone
 * @param loginEmail Supabase 에 실제로 넣는 이메일. 휴대폰이면 별칭입니다.
 * @param phoneLocal 하이픈 없는 국내 번호(01012345678). 이메일 가입이면 null.
 * @param phoneE164  국제 표기(+821012345678). 이메일 가입이면 null.
 */
public record SignupIdentifier(String channel, String loginEmail, String phoneLocal, String phoneE164) {
  private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s.]+(\\.[^@\\s.]+)+$");
  // 0으로 시작하는 9~11자리. 010 휴대폰이 기본이고 그 밖의 국번도 막지 않습니다.
  // 조건을 최소로 두는 쪽이 지금 방침입니다. 계정을 만들 수 있는 최소한만 봅니다.
  private static final Pattern PHONE_DIGITS = Pattern.compile("^0[0-9]{8,10}$");

  public boolean isPhone() {
    return "phone".equals(channel);
  }

  /**
   * 입력 한 줄을 이메일 또는 휴대폰으로 판별합니다.
   *
   * <p>판별 기준은 단순합니다. {@code @} 가 있으면 이메일, 숫자와 구분기호만 있으면 휴대폰입니다.
   * 둘 다 아니면 무엇을 입력했는지 알 수 없으므로 그대로 알려줍니다.
   */
  public static SignupIdentifier parse(String raw, String aliasDomain) {
    String value = raw == null ? "" : raw.trim();
    if (value.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "이메일 또는 휴대폰 번호를 입력해주세요.");
    }

    if (value.contains("@")) {
      String email = value.toLowerCase();
      if (!EMAIL.matcher(email).matches()) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "이메일 형식이 올바르지 않습니다.");
      }
      return new SignupIdentifier("email", email, null, null);
    }

    String digits = value.replaceAll("[^0-9]", "");
    // +82 10 ... 로 적어도 받아줍니다
    if (digits.startsWith("82")) digits = "0" + digits.substring(2);
    if (!PHONE_DIGITS.matcher(digits).matches()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "휴대폰 번호를 다시 확인해주세요.");
    }

    return new SignupIdentifier("phone", digits + "@" + aliasDomain, digits, "+82" + digits.substring(1));
  }
}
