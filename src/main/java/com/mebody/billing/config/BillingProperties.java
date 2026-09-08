package com.mebody.billing.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 결제 설정.
 *
 * <p>devMode 는 <b>사업자등록·PG 계약 전</b>에 앱의 결제 플로우 전체를 끝까지 돌려보기 위한
 * 스위치입니다. 켜면 실제 돈이 오가지 않고도 구독이 활성화되므로 <b>운영에서는 반드시 꺼야 합니다.</b>
 * 기본값이 false 이고, 켜져 있으면 시작할 때 경고 로그를 남깁니다.
 */
@ConfigurationProperties(prefix = "mebody.billing")
public record BillingProperties(
    boolean devMode,
    Integer subscriptionDays,
    Toss toss,
    GooglePlay googlePlay
) {
  public record Toss(String secretKey) {}
  public record GooglePlay(String packageName, String serviceAccountJson) {}

  public int subscriptionDaysOrDefault() {
    return subscriptionDays == null || subscriptionDays < 1 ? 30 : subscriptionDays;
  }

  public boolean tossConfigured() {
    return toss != null && toss.secretKey() != null && !toss.secretKey().isBlank();
  }

  public boolean googlePlayConfigured() {
    return googlePlay != null
        && googlePlay.serviceAccountJson() != null
        && !googlePlay.serviceAccountJson().isBlank();
  }
}
