package com.mebody.ads.controller;

import com.mebody.ads.dto.AdRewardConfigResponse;
import com.mebody.ads.service.AdRewardService;
import com.mebody.common.response.ApiResponse;
import com.mebody.common.security.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 보상형 광고 — AdMob 서버 검증(SSV) 콜백과 앱용 설정 조회. */
@RestController
@RequestMapping("/api/ads")
public class AdRewardController {
  private final AdRewardService adRewardService;
  private final CurrentUserService currentUserService;

  public AdRewardController(AdRewardService adRewardService, CurrentUserService currentUserService) {
    this.adRewardService = adRewardService;
    this.currentUserService = currentUserService;
  }

  /**
   * AdMob 이 부르는 콜백. <b>인증이 없습니다</b> — 신뢰의 근거는 요청에 붙은 ECDSA 서명입니다.
   *
   * <p>원본 쿼리스트링을 그대로 써야 합니다. 파라미터를 다시 조립하면 순서가 달라져
   * 서명이 맞지 않습니다. 그래서 {@link HttpServletRequest#getQueryString()} 을 씁니다.
   *
   * <p>응답 코드의 뜻: AdMob 은 2xx 가 아니면 재전송합니다. 그래서
   * <b>다시 보내도 결과가 같을 상황(서명 불일치, 자격 미달)은 200</b> 으로 답하고,
   * 우리 쪽 일시적 문제(SSV 미설정)만 5xx 로 답합니다.
   */
  @GetMapping("/admob/ssv")
  public ResponseEntity<String> admobSsv(HttpServletRequest request) {
    if (!adRewardService.ssvEnabled()) {
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body("ssv disabled");
    }

    Map<String, String> params = new HashMap<>();
    request.getParameterMap().forEach((key, values) -> {
      if (values != null && values.length > 0) params.put(key, values[0]);
    });

    AdRewardService.Outcome outcome = adRewardService.handleAdMobCallback(request.getQueryString(), params);
    return ResponseEntity.ok(outcome.name().toLowerCase());
  }

  /** 앱이 "내가 직접 청구할까, 서버 지급을 기다릴까" 를 정할 때 씁니다. */
  @GetMapping("/config")
  public ApiResponse<AdRewardConfigResponse> config() {
    currentUserService.requireCurrentUser();
    return ApiResponse.ok(new AdRewardConfigResponse(adRewardService.ssvEnabled()));
  }

  /** 콜백 URL 이 살아 있는지 확인용(AdMob 콘솔 등록 전에 눌러 보기). */
  @GetMapping("/admob/ssv/health")
  public ResponseEntity<String> health(@RequestParam(required = false) String ping) {
    return ResponseEntity.ok(adRewardService.ssvEnabled() ? "enabled" : "disabled");
  }
}
