package com.mebody.auth.controller;

import com.mebody.auth.config.AuthSignupProperties;
import com.mebody.auth.dto.AccountApprovalRequest;
import com.mebody.auth.dto.AccountApprovalResponse;
import com.mebody.auth.dto.AuthConfigResponse;
import com.mebody.auth.dto.PublicSignupRequest;
import com.mebody.auth.dto.PublicSignupResponse;
import com.mebody.auth.service.PublicAuthService;
import com.mebody.common.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/auth")
public class PublicAuthController {
  private final PublicAuthService publicAuthService;
  private final AuthSignupProperties authSignupProperties;

  public PublicAuthController(PublicAuthService publicAuthService, AuthSignupProperties authSignupProperties) {
    this.publicAuthService = publicAuthService;
    this.authSignupProperties = authSignupProperties;
  }

  /** 회원가입. identifier 에 이메일 또는 휴대폰 번호를 보냅니다. */
  @PostMapping("/signup")
  public ApiResponse<PublicSignupResponse> signup(@Valid @RequestBody PublicSignupRequest request) {
    return ApiResponse.ok(publicAuthService.signup(request));
  }

  /**
   * 승인 대기로 남은 계정 풀기.
   *
   * <p>로그인이 {@code email_not_confirmed} 로 막혔을 때 호출부가 부르고 다시 로그인합니다.
   * 승인만 할 뿐 로그인을 시켜주지 않으므로 비밀번호는 여전히 맞아야 합니다.
   */
  @PostMapping("/approve")
  public ApiResponse<AccountApprovalResponse> approve(@Valid @RequestBody AccountApprovalRequest request) {
    return ApiResponse.ok(publicAuthService.approve(request.identifier()));
  }

  /** 지금 확인 절차가 켜져 있는지, 휴대폰 별칭 도메인이 무엇인지. */
  @GetMapping("/config")
  public ApiResponse<AuthConfigResponse> config() {
    return ApiResponse.ok(new AuthConfigResponse(
        authSignupProperties.emailVerificationRequired(),
        authSignupProperties.phoneVerificationRequired(),
        authSignupProperties.phoneNativeMode() ? "native" : "alias",
        authSignupProperties.aliasDomain(),
        authSignupProperties.minPasswordLengthOrDefault()));
  }
}
