package com.mebody.professional.controller;

import com.mebody.common.response.ApiResponse;
import com.mebody.professional.dto.ClientListItem;
import com.fasterxml.jackson.databind.JsonNode;
import com.mebody.professional.dto.AssignMissionRequest;
import com.mebody.professional.dto.AssignableContent;
import com.mebody.professional.dto.ClientJourneyResponse;
import com.mebody.professional.dto.ClientResultResponse;
import com.mebody.professional.dto.CreateInviteResponse;
import com.mebody.professional.dto.ProfessionalProfileResponse;
import com.mebody.professional.service.ProfessionalService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 전문가 콘솔이 쓰는 경로. 전부 로그인이 필요하고, 활성 전문가가 아니면 403 입니다.
 * 그 판단은 서비스가 {@code current_professional_id()} 로 합니다.
 */
@RestController
@RequestMapping("/api/professional")
public class ProfessionalController {
  private final ProfessionalService professionalService;

  public ProfessionalController(ProfessionalService professionalService) {
    this.professionalService = professionalService;
  }

  @GetMapping("/me")
  public ApiResponse<ProfessionalProfileResponse> me() {
    return ApiResponse.ok(professionalService.myProfile());
  }

  @GetMapping("/clients")
  public ApiResponse<List<ClientListItem>> clients() {
    return ApiResponse.ok(professionalService.listClients());
  }

  /** 초대 만들기. 링크(토큰 포함)는 이 응답과 "아직 안 쓴 초대" 목록에만 나옵니다. */
  @PostMapping("/clients/invite")
  public ApiResponse<CreateInviteResponse> invite() {
    return ApiResponse.ok(professionalService.createInvite());
  }

  /** 고객 결과 1건. 동의가 없으면 404 입니다. */
  @GetMapping("/clients/{clientUserId}")
  public ApiResponse<ClientResultResponse> client(@PathVariable UUID clientUserId) {
    return ApiResponse.ok(professionalService.clientResult(clientUserId));
  }

  /** 고객의 수행 기록 — 진행률·일자별·피드백. 동의가 없으면 404 입니다. */
  @GetMapping("/clients/{clientUserId}/journey")
  public ApiResponse<ClientJourneyResponse> clientJourney(@PathVariable UUID clientUserId) {
    return ApiResponse.ok(professionalService.clientJourney(clientUserId));
  }

  /** 배정할 수 있는 동작 목록. 라이브러리에 있는 것이 전부입니다. */
  @GetMapping("/contents")
  public ApiResponse<List<AssignableContent>> contents() {
    return ApiResponse.ok(professionalService.assignableContents());
  }

  /** 고객에게 미션을 배정합니다. 하루 3개까지, 메모는 200자까지. */
  @PostMapping("/clients/{clientUserId}/missions")
  public ApiResponse<Map<String, Object>> assign(@PathVariable UUID clientUserId,
                                                 @Valid @RequestBody AssignMissionRequest request) {
    return ApiResponse.ok(Map.of("missionId", professionalService.assignMission(clientUserId, request)));
  }

  /**
   * 초안 재료. 실제 계산은 콘솔이 앱과 같은 코드로 합니다(journey-rules.js).
   * 서버는 자료만 모아 내려줍니다.
   */
  @GetMapping("/clients/{clientUserId}/plan-input")
  public ApiResponse<JsonNode> planInput(@PathVariable UUID clientUserId) {
    return ApiResponse.ok(professionalService.clientPlanInput(clientUserId));
  }

  /** 아직 시작하지 않은 내 배정을 거둡니다. */
  @DeleteMapping("/missions/{missionId}")
  public ApiResponse<Map<String, Object>> cancelAssignment(@PathVariable UUID missionId) {
    return ApiResponse.ok(Map.of("cancelled", professionalService.cancelAssignment(missionId)));
  }

  /** 전문가가 관계를 끊습니다. */
  @DeleteMapping("/clients/{relationId}")
  public ApiResponse<Void> revoke(@PathVariable UUID relationId) {
    professionalService.revokeClient(relationId);
    return ApiResponse.ok(null);
  }
}
