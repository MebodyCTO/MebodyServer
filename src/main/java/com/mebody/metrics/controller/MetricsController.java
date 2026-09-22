package com.mebody.metrics.controller;

import com.mebody.common.response.ApiResponse;
import com.mebody.metrics.dto.MetricsResponse;
import com.mebody.metrics.service.MetricsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 운영자 지표. 관리자만 볼 수 있습니다. */
@RestController
@RequestMapping("/api/admin/metrics")
public class MetricsController {
  private final MetricsService metricsService;

  public MetricsController(MetricsService metricsService) {
    this.metricsService = metricsService;
  }

  @GetMapping("/funnels")
  public ApiResponse<MetricsResponse> funnels(@RequestParam(defaultValue = "30") int days) {
    return ApiResponse.ok(metricsService.funnels(days));
  }
}
