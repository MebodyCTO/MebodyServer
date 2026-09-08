package com.mebody.ads.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mebody.ads.config.AdRewardProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * AdMob 보상형 광고 콜백의 서명을 검증합니다.
 *
 * <p>검증 방식(Google 문서 기준):
 * <ol>
 *   <li>검증 대상은 <b>쿼리스트링에서 {@code &signature=} 앞까지</b>입니다.
 *       파라미터를 정렬하거나 다시 조립하면 안 됩니다 — <b>받은 순서 그대로</b>여야 합니다.
 *       그래서 이 클래스는 파싱된 Map 이 아니라 원본 쿼리스트링을 받습니다.</li>
 *   <li>{@code key_id} 로 공개키를 고르고, {@code signature}(base64url, DER)를
 *       SHA256withECDSA 로 검증합니다.</li>
 * </ol>
 *
 * <p>공개키 목록은 캐시합니다. 다만 <b>모르는 key_id 가 오면 한 번 갱신</b>합니다 —
 * Google 이 키를 교체하면 캐시만 믿을 경우 모든 콜백이 실패하기 때문입니다.
 */
@Component
public class AdMobSsvVerifier {
  private static final Logger log = LoggerFactory.getLogger(AdMobSsvVerifier.class);
  private static final Duration REFRESH_INTERVAL = Duration.ofMinutes(10);

  private final AdRewardProperties properties;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private final AtomicReference<Keys> cache = new AtomicReference<>(null);

  private record Keys(Map<String, PublicKey> byId, Instant fetchedAt) {}

  public AdMobSsvVerifier(AdRewardProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  /**
   * @param rawQuery 서블릿이 준 원본 쿼리스트링 (디코딩·정렬하지 않은 것)
   * @return 서명이 맞으면 true
   */
  public boolean verify(String rawQuery) {
    if (rawQuery == null || rawQuery.isBlank()) return false;

    int signatureAt = rawQuery.indexOf("&signature=");
    if (signatureAt < 0) {
      log.warn("AdMob SSV: signature 파라미터가 없습니다");
      return false;
    }
    String content = rawQuery.substring(0, signatureAt);
    String tail = rawQuery.substring(signatureAt + 1);

    String signatureB64 = paramFrom(tail, "signature");
    String keyId = paramFrom(tail, "key_id");
    if (signatureB64 == null || keyId == null) {
      log.warn("AdMob SSV: signature 또는 key_id 를 읽지 못했습니다");
      return false;
    }

    PublicKey key = lookup(keyId, false);
    if (key == null) {
      // 키가 교체됐을 수 있으니 강제로 다시 받아 본다.
      key = lookup(keyId, true);
    }
    if (key == null) {
      log.warn("AdMob SSV: 알 수 없는 key_id={}", keyId);
      return false;
    }

    try {
      Signature verifier = Signature.getInstance("SHA256withECDSA");
      verifier.initVerify(key);
      verifier.update(content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      return verifier.verify(Base64.getUrlDecoder().decode(signatureB64));
    } catch (Exception e) {
      log.warn("AdMob SSV: 서명 검증 실패: {}", e.toString());
      return false;
    }
  }

  /** {@code a=1&b=2} 형태에서 값 하나를 꺼냅니다(디코딩하지 않습니다 — 서명 원문 그대로 씁니다). */
  private String paramFrom(String query, String name) {
    for (String part : query.split("&")) {
      int eq = part.indexOf('=');
      if (eq > 0 && part.substring(0, eq).equals(name)) {
        return part.substring(eq + 1);
      }
    }
    return null;
  }

  private PublicKey lookup(String keyId, boolean force) {
    Keys current = cache.get();
    boolean stale = current == null
        || force
        || current.fetchedAt().plus(REFRESH_INTERVAL).isBefore(Instant.now());
    if (!stale) {
      return current.byId().get(keyId);
    }
    if (current != null && !force && current.byId().containsKey(keyId)) {
      return current.byId().get(keyId);
    }

    Keys fetched = fetchKeys();
    if (fetched != null) {
      cache.set(fetched);
      return fetched.byId().get(keyId);
    }
    return current == null ? null : current.byId().get(keyId);
  }

  private Keys fetchKeys() {
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(properties.verifierKeysUrlOrDefault()))
          .timeout(Duration.ofSeconds(8))
          .GET()
          .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        log.warn("AdMob SSV: 공개키 목록 응답 {}", response.statusCode());
        return null;
      }

      JsonNode root = objectMapper.readTree(response.body());
      Map<String, PublicKey> keys = new HashMap<>();
      for (JsonNode node : root.path("keys")) {
        String id = node.path("keyId").asText(null);
        String base64 = node.path("base64").asText(null);
        if (id == null || base64 == null) continue;
        try {
          byte[] der = Base64.getDecoder().decode(base64);
          keys.put(id, KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(der)));
        } catch (Exception e) {
          log.warn("AdMob SSV: keyId={} 를 읽지 못했습니다: {}", id, e.toString());
        }
      }
      if (keys.isEmpty()) {
        log.warn("AdMob SSV: 공개키를 하나도 읽지 못했습니다");
        return null;
      }
      return new Keys(Map.copyOf(keys), Instant.now());
    } catch (Exception e) {
      log.warn("AdMob SSV: 공개키 목록을 가져오지 못했습니다: {}", e.toString());
      return null;
    }
  }
}
