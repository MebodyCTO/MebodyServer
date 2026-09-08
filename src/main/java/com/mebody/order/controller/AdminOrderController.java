package com.mebody.order.controller;

import com.mebody.common.response.ApiResponse;
import com.mebody.order.dto.AdminOrderDto;
import com.mebody.order.dto.FulfillmentRequest;
import com.mebody.order.service.AdminOrderService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 주문 관리 — 관리자는 전부, 판매자는 자기 상품이 든 주문만. */
@RestController
@RequestMapping("/api/admin/orders")
public class AdminOrderController {
  private final AdminOrderService adminOrderService;

  public AdminOrderController(AdminOrderService adminOrderService) {
    this.adminOrderService = adminOrderService;
  }

  @GetMapping
  public ApiResponse<List<AdminOrderDto>> orders(@RequestParam(required = false) String fulfillment) {
    return ApiResponse.ok(adminOrderService.list(fulfillment));
  }

  @PostMapping("/{id}/fulfillment")
  public ApiResponse<AdminOrderDto> setFulfillment(
      @PathVariable UUID id,
      @Valid @RequestBody FulfillmentRequest request) {
    return ApiResponse.ok(
        adminOrderService.setFulfillment(id, request.status(), request.carrier(), request.trackingNo()),
        "배송 상태가 변경되었습니다.");
  }
}
