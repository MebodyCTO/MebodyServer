package com.mebody.auth.controller;

import com.mebody.auth.config.AuthSignupProperties;
import com.mebody.auth.dto.AccountApprovalRequest;
import com.mebody.auth.dto.AccountApprovalResponse;
import com.mebody.auth.dto.AuthConfigResponse;
import com.mebody.auth.dto.PhoneLoginRequest;
import com.mebody.auth.dto.PhoneResetRequest;
import com.fasterxml.jackson.databind.JsonNode;
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

  /**
   * 번호로 로그인. 비밀번호가 맞을 때만 세션이 나갑니다.
   *
   * <p>복구 이메일을 적고 가입한 계정은 이메일이 별칭이 아니라서, 앱이 번호를 별칭으로
   * 바꿔 보내는 방식만으로는 로그인할 수 없습니다. 그 경우를 서버가 대신 찾아 줍니다.
   */
  @PostMapping("/login")
  public ApiResponse<JsonNode> loginByPhone(@Valid @RequestBody PhoneLoginRequest request) {
    return ApiResponse.ok(publicAuthService.loginByPhone(request.identifier(), request.password()));
  }

  /**
   * 번호로 비밀번호 재설정 요청.
   *
   * <p>계정이 있든 없든 항상 같은 응답입니다. 응답이 갈리면 번호만으로 가입 여부를 알아낼 수 있습니다.
   */
  @PostMapping("/reset")
  public ApiResponse<Void> requestReset(@Valid @RequestBody PhoneResetRequest request) {
    publicAuthService.requestPhonePasswordReset(request.identifier(), request.redirectTo());
    return ApiResponse.ok(null);
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
