package com.mebody.web.controller;

import com.mebody.common.response.ApiResponse;
import com.mebody.common.security.SupabaseProperties;
import com.mebody.web.dto.PublicConfigResponse;
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
