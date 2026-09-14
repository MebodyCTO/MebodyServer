package com.mebody.auth.dto;

import java.util.UUID;

/**
 * 회원가입 결과.
 *
 * @param channel              email 또는 phone
 * @param loginEmail           앱이 곧바로 로그인할 때 쓸 값. 휴대폰 가입이면 별칭 이메일입니다.
 * @param verificationRequired true 면 확인 절차가 남아 있어 아직 로그인할 수 없습니다.
 * @param verificationHint     사용자에게 보여줄 다음 단계 안내. 확인이 필요 없으면 null.
 * @param alreadyRegistered    이미 있는 계정이라 새로 만들지 않았습니다. 앱은 로그인으로 넘어갑니다.
 */
public record PublicSignupResponse(
    UUID authUserId,
    String channel,
    String loginEmail,
    String displayName,
    boolean verificationRequired,
    String verificationHint,
    boolean alreadyRegistered
) {
}
