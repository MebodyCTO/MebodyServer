package com.mebody.account.controller;

import com.mebody.account.dto.AccountDeletionResponse;
import com.mebody.account.service.AccountDeletionService;
import com.mebody.common.response.ApiResponse;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/account")
public class AccountController {
  private final AccountDeletionService accountDeletionService;

  public AccountController(AccountDeletionService accountDeletionService) {
    this.accountDeletionService = accountDeletionService;
  }

  /** 내 계정 탈퇴. 로그인 필요하며, 남의 계정은 지정할 수 없습니다. */
  @DeleteMapping
  public ApiResponse<AccountDeletionResponse> deleteMyAccount() {
    return ApiResponse.ok(accountDeletionService.deleteMyAccount());
  }
}
