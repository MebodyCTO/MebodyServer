package com.mebody.billing.controller;

import com.mebody.billing.dto.BillingConfigResponse;
import com.mebody.billing.dto.OrderConfirmRequest;
import com.mebody.billing.dto.OrderCancelResult;
import com.mebody.billing.dto.OrderPaymentDto;
import com.mebody.billing.dto.SubscriptionStateDto;
import com.mebody.billing.dto.SubscriptionVerifyRequest;
import com.mebody.billing.service.BillingService;
import com.mebody.common.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 앱에서 부르는 결제 API. 상태 변경은 전부 여기를 지나갑니다. */
@RestController
@RequestMapping("/api/billing")
public class BillingController {
  private final BillingService billingService;

  public BillingController(BillingService billingService) {
    this.billingService = billingService;
  }

  /** 지금 어떤 결제가 가능한지. provider 가 null 이면 앱은 결제 버튼을 잠급니다. */
  @GetMapping("/config")
  public ApiResponse<BillingConfigResponse> config() {
    return ApiResponse.ok(billingService.config());
  }

  @PostMapping("/subscription/verify")
  public ApiResponse<SubscriptionStateDto> verifySubscription(@Valid @RequestBody SubscriptionVerifyRequest request) {
    return ApiResponse.ok(
        billingService.verifySubscription(request.planCode(), request.purchaseToken()),
        "멤버십이 활성화되었습니다.");
  }

  @PostMapping("/subscription/cancel")
  public ApiResponse<SubscriptionStateDto> cancelSubscription(
      @RequestParam(defaultValue = "false") boolean immediate) {
    return ApiResponse.ok(
        billingService.cancelSubscription(immediate),
        immediate ? "멤버십이 즉시 해지되었습니다." : "이용 기간이 끝나면 해지됩니다.");
  }

  @PostMapping("/orders/{orderId}/cancel")
  public ApiResponse<OrderCancelResult> cancelOrder(
      @PathVariable UUID orderId,
      @RequestParam(required = false) String reason) {
    return ApiResponse.ok(billingService.cancelOrder(orderId, reason), "주문이 취소되었습니다.");
  }

  @PostMapping("/orders/{orderId}/confirm")
  public ApiResponse<OrderPaymentDto> confirmOrder(
      @PathVariable UUID orderId,
      @Valid @RequestBody OrderConfirmRequest request) {
    return ApiResponse.ok(billingService.confirmOrder(orderId, request.paymentKey()), "결제가 완료되었습니다.");
  }
}
