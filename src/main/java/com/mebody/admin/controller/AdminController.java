package com.mebody.admin.controller;

import com.mebody.admin.dto.AdminCreateUserRequest;
import com.mebody.admin.dto.AdminDashboardSummary;
import com.mebody.admin.dto.AdminUpdateUserRequest;
import com.mebody.admin.dto.AdminUserSearchRequest;
import com.mebody.admin.service.AdminService;
import com.mebody.common.response.ApiResponse;
import com.mebody.professional.dto.IssueProfessionalRequest;
import com.mebody.professional.dto.ProfessionalProfileResponse;
import com.mebody.professional.service.ProfessionalService;
import com.mebody.user.domain.UserGrade;
import com.mebody.user.domain.UserRole;
import com.mebody.user.domain.UserStatus;
import com.mebody.user.dto.UserProfileDto;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
  private final AdminService adminService;
  private final ProfessionalService professionalService;

  public AdminController(AdminService adminService, ProfessionalService professionalService) {
    this.adminService = adminService;
    this.professionalService = professionalService;
  }


  @GetMapping("/dashboard/summary")
  public ApiResponse<AdminDashboardSummary> dashboardSummary() {
    return ApiResponse.ok(adminService.dashboardSummary());
  }

  @GetMapping("/me")
  public ApiResponse<UserProfileDto> adminMe() {
    return ApiResponse.ok(adminService.adminMe());
  }

  @GetMapping("/users")
  public ApiResponse<Page<UserProfileDto>> users(
      @RequestParam(required = false) String search,
      @RequestParam(required = false) UserRole role,
      @RequestParam(required = false) UserStatus status,
      @RequestParam(required = false) UserGrade grade,
      @RequestParam(defaultValue = "false") boolean includeDeleted,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size
  ) {
    return ApiResponse.ok(adminService.users(new AdminUserSearchRequest(search, role, status, grade, includeDeleted, page, size)));
  }

  @GetMapping("/users/{id}")
  public ApiResponse<UserProfileDto> user(@PathVariable UUID id) {
    return ApiResponse.ok(adminService.user(id));
  }

  /**
   * 전문가 계정 발급. 이미 가입된 계정의 역할을 올립니다.
   *
   * <p>여기서 계정을 새로 만들지 않습니다. 만드는 일까지 겸하면 "전문가 승인은 사람이 한다"
   * 는 전제가 사라집니다(`db/journey/052` 의 professionals_admin_write 와 같은 이유).
   */
  @PostMapping("/professionals")
  public ApiResponse<ProfessionalProfileResponse> issueProfessional(
      @Valid @RequestBody IssueProfessionalRequest request) {
    return ApiResponse.ok(professionalService.issueProfessional(request));
  }

  @PostMapping("/users")
  public ApiResponse<UserProfileDto> createUser(@Valid @RequestBody AdminCreateUserRequest request) {
    return ApiResponse.ok(adminService.createUser(request));
  }

  @PatchMapping("/users/{id}")
  public ApiResponse<UserProfileDto> updateUser(@PathVariable UUID id, @Valid @RequestBody AdminUpdateUserRequest request) {
    return ApiResponse.ok(adminService.updateUser(id, request));
  }

  @DeleteMapping("/users/{id}")
  public ApiResponse<Void> deleteUser(@PathVariable UUID id) {
    adminService.deleteUser(id);
    return ApiResponse.ok(null, "회원이 삭제 처리되었습니다.");
  }
}
