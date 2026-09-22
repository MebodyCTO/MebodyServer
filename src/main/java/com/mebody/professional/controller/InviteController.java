package com.mebody.professional.controller;

import com.mebody.common.response.ApiResponse;
import com.mebody.professional.dto.AcceptInviteResponse;
import com.mebody.professional.dto.InvitePreviewResponse;
import com.mebody.professional.dto.MyProfessionalItem;
import java.util.List;
import com.mebody.professional.service.ProfessionalService;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 고객 쪽 경로. 초대 링크를 연 사람이 씁니다.
 *
 * <p>미리보기만 로그인 없이 열립니다. 누가 부른 링크인지 모르는 채로 로그인하라고 할 수는
 * 없어서 전문가 이름만 알려줍니다. 토큰은 32바이트 난수라 "토큰을 아는 사람" 에게만 보입니다.
 * 없는 토큰과 만료된 토큰의 답이 같아서, 토큰을 넣어 보며 무언가를 캐낼 수 없습니다.
 *
 * <p>수락은 반드시 로그인 상태여야 합니다. 서버가 <b>토큰이 가리키는 사람</b>이 아니라
 * <b>지금 로그인한 사람</b>을 고객으로 묶기 때문에, 링크를 주운 사람이 남의 계정을
 * 연결할 방법이 없습니다.
 */
@RestController
@RequestMapping("/api")
public class InviteController {
  private final ProfessionalService professionalService;

  public InviteController(ProfessionalService professionalService) {
    this.professionalService = professionalService;
  }

  /** 로그인 전에 "누가 불렀는지" 만. SecurityConfig 에서 permitAll 입니다. */
  @GetMapping("/public/professional/invite/{token}")
  public ApiResponse<InvitePreviewResponse> preview(@PathVariable String token) {
    return ApiResponse.ok(professionalService.previewInvite(token));
  }

  /** 고객이 동의합니다. 로그인한 본인만 자기를 묶을 수 있습니다. */
  @PostMapping("/invites/{token}/accept")
  public ApiResponse<AcceptInviteResponse> accept(@PathVariable String token) {
    return ApiResponse.ok(professionalService.acceptInvite(token));
  }

  /** 내가 결과를 보여주기로 한 전문가 목록. 마이페이지에서 씁니다. */
  @GetMapping("/invites/relations")
  public ApiResponse<List<MyProfessionalItem>> myProfessionals() {
    return ApiResponse.ok(professionalService.listMyProfessionals());
  }

  /** 고객이 동의를 거둡니다. 이 순간부터 전문가는 0행을 받습니다. */
  @DeleteMapping("/invites/relations/{relationId}")
  public ApiResponse<Void> withdraw(@PathVariable UUID relationId) {
    professionalService.withdrawConsent(relationId);
    return ApiResponse.ok(null);
  }
}
