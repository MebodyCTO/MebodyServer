package com.mebody.web.controller;

import com.mebody.common.response.ApiResponse;
import com.mebody.common.security.SupabaseProperties;
import com.mebody.web.dto.PublicConfigResponse;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
public class PublicConfigController {
  private static final String DEFAULT_APP_URL = "https://mebody-jjh.vercel.app";

  private final SupabaseProperties supabaseProperties;
  private final String configuredAppUrl;

  public PublicConfigController(
      SupabaseProperties supabaseProperties,
      @Value("${mebody.app-url:}") String appUrl
  ) {
    this.supabaseProperties = supabaseProperties;
    this.configuredAppUrl = appUrl;
  }

  /**
   * 살아있는지 확인용. 인증도 DB 조회도 하지 않습니다.
   *
   * <p>배포 주소가 404 를 낼 때 원인을 가르는 데 씁니다. 여기서 200 이 나오면 우리 앱이 떠 있는
   * 것이고, 그래도 404 면 플랫폼(Railway 등) 엣지가 내는 404 입니다 — 즉 배포본이 없는 겁니다.
   *
   * <p>{@code /health}(HealthController) 와 따로 두는 이유는 타는 필터 체인이 다르기 때문입니다.
   * {@code /health} 는 정적 체인(Order 1)이 받고, 이쪽은 {@code /api/**} 체인(Order 2)이 받습니다.
   * 이 프로젝트는 Vercel 과 Railway 를 같이 쓰므로 앞단이 {@code /health} 를 가로채도
   * 이 경로로 "스프링의 API 체인이 실제로 살아 있는가" 를 따로 확인할 수 있습니다.
   */
  @GetMapping("/health")
  public Map<String, Object> health() {
    return Map.of("status", "up", "service", "mebody-server");
  }

  @GetMapping("/config")
  public ApiResponse<PublicConfigResponse> config() {
    return ApiResponse.ok(new PublicConfigResponse(
        valueOrEmpty(supabaseProperties.url()),
        valueOrEmpty(supabaseProperties.anonKey()),
        resolveAppUrl()
    ));
  }

  private String resolveAppUrl() {
    if (configuredAppUrl != null && !configuredAppUrl.isBlank()) {
      return configuredAppUrl.trim();
    }
    return DEFAULT_APP_URL;
  }

  private String valueOrEmpty(String value) {
    return value == null ? "" : value;
  }
}
