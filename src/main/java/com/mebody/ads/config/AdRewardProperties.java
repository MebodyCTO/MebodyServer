package com.mebody.ads.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 보상형 광고 서버 검증(SSV) 설정.
 *
 * <p>기본값은 꺼짐입니다. AdMob 콘솔의 광고 단위에 콜백 URL 을 등록한 뒤에 켜세요.
 * 켜기 전까지는 앱이 직접 보너스를 청구하는 기존 방식이 그대로 동작합니다.
 */
@ConfigurationProperties(prefix = "mebody.ads")
public record AdRewardProperties(
    boolean ssvEnabled,
    String verifierKeysUrl,
    Integer maxAgeSeconds
) {
  public String verifierKeysUrlOrDefault() {
    return verifierKeysUrl == null || verifierKeysUrl.isBlank()
        ? "https://gstatic.com/admob/reward/verifier-keys.json"
        : verifierKeysUrl;
  }

  /** 오래된 콜백은 재전송 공격으로 보고 거절합니다. */
  public int maxAgeSecondsOrDefault() {
    return maxAgeSeconds == null || maxAgeSeconds < 60 ? 3600 : maxAgeSeconds;
  }
}
