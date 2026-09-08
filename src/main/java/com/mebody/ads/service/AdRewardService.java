package com.mebody.ads.service;

import com.mebody.ads.config.AdRewardProperties;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AdMob 보상형 광고 콜백 처리.
 *
 * <p>지금까지는 앱이 "광고 다 봤다" 고 말하면 그대로 지급했습니다. AdMob 은 광고를
 * <b>실제로 끝까지 본 경우에만</b> 서버로 콜백을 보내고 거기에 서명을 붙입니다.
 * 서명을 검증하고 지급하면 앱을 믿지 않아도 됩니다.
 *
 * <p>같은 콜백이 재전송돼도 두 번 지급되지 않습니다 — 두 겹으로 막습니다:
 * <ul>
 *   <li>ad_reward_callbacks 의 UNIQUE(provider, transaction_id)</li>
 *   <li>보너스 자체가 사용자+날짜로 결정되는 source_id 를 쓰는 하루 한 번짜리라는 점</li>
 * </ul>
 */
@Service
public class AdRewardService {
  private static final Logger log = LoggerFactory.getLogger(AdRewardService.class);

  private final JdbcTemplate jdbc;
  private final AdMobSsvVerifier verifier;
  private final AdRewardProperties properties;

  public AdRewardService(JdbcTemplate jdbc, AdMobSsvVerifier verifier, AdRewardProperties properties) {
    this.jdbc = jdbc;
    this.verifier = verifier;
    this.properties = properties;
  }

  public boolean ssvEnabled() {
    return properties.ssvEnabled();
  }

  /** 처리 결과. AdMob 에는 재전송이 의미 있을 때만 실패로 답합니다. */
  public enum Outcome { GRANTED, ALREADY, REJECTED }

  @Transactional
  public Outcome handleAdMobCallback(String rawQuery, Map<String, String> params) {
    String txn = params.get("transaction_id");
    String userIdRaw = params.get("user_id");

    if (txn == null || txn.isBlank()) {
      log.warn("AdMob SSV: transaction_id 가 없습니다");
      return Outcome.REJECTED;
    }

    // 1) 서명. 여기서 막히면 앱이 위조한 요청이거나 우리 키 캐시가 틀린 것입니다.
    if (!verifier.verify(rawQuery)) {
      record(txn, null, params, Outcome.REJECTED, "signature invalid");
      return Outcome.REJECTED;
    }

    // 2) 재전송 방지 — 오래된 콜백은 받지 않습니다.
    String timestamp = params.get("timestamp");
    if (!freshEnough(timestamp)) {
      record(txn, null, params, Outcome.REJECTED, "stale timestamp: " + timestamp);
      return Outcome.REJECTED;
    }

    UUID user;
    try {
      user = UUID.fromString(String.valueOf(userIdRaw));
    } catch (Exception e) {
      record(txn, null, params, Outcome.REJECTED, "user_id not a uuid: " + userIdRaw);
      return Outcome.REJECTED;
    }

    // 3) 같은 거래를 이미 처리했는가.
    Integer seen = jdbc.queryForObject(
        "SELECT count(*) FROM public.ad_reward_callbacks WHERE provider = 'admob' AND transaction_id = ?",
        Integer.class, txn);
    if (seen != null && seen > 0) {
      return Outcome.ALREADY;
    }

    // 4) 지급. 자격이 안 되면(유료 회원, 기본 적립 전) 예외가 나고 그대로 기록합니다.
    try {
      Map<String, Object> granted = jdbc.queryForMap(
          "SELECT * FROM public.grant_routine_bonus_admin(?::uuid)", user);
      boolean already = Boolean.TRUE.equals(granted.get("already_claimed"));
      record(txn, user, params, already ? Outcome.ALREADY : Outcome.GRANTED, null);
      return already ? Outcome.ALREADY : Outcome.GRANTED;
    } catch (org.springframework.dao.DataAccessException e) {
      String reason = String.valueOf(e.getMostSpecificCause().getMessage());
      record(txn, user, params, Outcome.REJECTED, reason);
      log.info("AdMob SSV: 보너스 지급 조건 불충족 (user={}): {}", user, reason);
      return Outcome.REJECTED;
    }
  }

  private boolean freshEnough(String timestamp) {
    if (timestamp == null || timestamp.isBlank()) return false;
    try {
      // AdMob 의 timestamp 는 epoch 밀리초입니다.
      long millis = Long.parseLong(timestamp);
      long ageSeconds = Math.abs(Instant.now().toEpochMilli() - millis) / 1000L;
      return ageSeconds <= properties.maxAgeSecondsOrDefault();
    } catch (NumberFormatException e) {
      return false;
    }
  }

  private void record(String txn, UUID user, Map<String, String> params, Outcome outcome, String reason) {
    try {
      jdbc.update(
          "INSERT INTO public.ad_reward_callbacks"
              + " (provider, transaction_id, user_id, ad_unit, reward_item, reward_amount, custom_data, status, reason, raw)"
              + " VALUES ('admob', ?, ?::uuid, ?, ?, ?, ?, ?, ?, ?)"
              + " ON CONFLICT (provider, transaction_id) DO NOTHING",
          txn,
          user == null ? null : user.toString(),
          params.get("ad_unit"),
          params.get("reward_item"),
          parseInt(params.get("reward_amount")),
          params.get("custom_data"),
          outcome.name(),
          reason,
          params.toString());
    } catch (RuntimeException e) {
      // 원장 기록 실패가 지급 자체를 되돌릴 이유는 아니지만, 조용히 넘기면 대사가 안 됩니다.
      log.warn("AdMob SSV: 콜백 기록 실패 (txn={}): {}", txn, e.toString());
    }
  }

  private Integer parseInt(String value) {
    try {
      return value == null ? null : Integer.valueOf(value);
    } catch (NumberFormatException e) {
      return null;
    }
  }
}
