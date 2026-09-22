package com.mebody.common.security;

import com.mebody.common.exception.ForbiddenException;
import com.mebody.common.exception.UnauthorizedException;
import com.mebody.user.domain.UserProfile;
import com.mebody.user.domain.UserRole;
import com.mebody.user.domain.UserStatus;
import com.mebody.user.repository.UserProfileRepository;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrentUserService {
  private final UserProfileRepository userProfileRepository;
  private final JdbcTemplate jdbcTemplate;

  public CurrentUserService(UserProfileRepository userProfileRepository, JdbcTemplate jdbcTemplate) {
    this.userProfileRepository = userProfileRepository;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Transactional
  public CurrentUser requireCurrentUser() {
    Jwt jwt = currentJwt();
    UUID authUserId = UUID.fromString(jwt.getSubject());
    String email = jwt.getClaimAsString("email");

    // 탈퇴한 계정의 토큰은 만료될 때까지 서명이 유효합니다. 그대로 두면 아래에서
    // 프로필을 새로 만들려다 외래키에 걸려 500 이 납니다. 없는 계정이면 여기서 끊습니다.
    if (!authUserExists(authUserId)) {
      throw new UnauthorizedException("이미 탈퇴했거나 사용할 수 없는 계정입니다.");
    }

    UserProfile profile = userProfileRepository.findByAuthUserId(authUserId)
        .or(() -> userProfileRepository.findById(authUserId))
        .or(() -> findByEmail(email))
        .orElseGet(() -> userProfileRepository.save(UserProfile.newMember(authUserId, email)));

    if (profile.getAuthUserId() == null) {
      profile.setAuthUserId(authUserId);
    }
    if (profile.getEmail() == null && email != null) {
      profile.setEmail(email);
    }

    if (profile.getStatus() == UserStatus.DELETED || profile.getStatus() == UserStatus.SUSPENDED) {
      throw new ForbiddenException("비활성화된 계정입니다.");
    }

    return CurrentUser.from(profile);
  }

  /** auth.users 에 아직 있는 계정인지. 탈퇴 직후의 토큰을 걸러냅니다. */
  private boolean authUserExists(UUID authUserId) {
    Boolean exists = jdbcTemplate.queryForObject(
        "SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = ?)", Boolean.class, authUserId);
    return Boolean.TRUE.equals(exists);
  }

  private Optional<UserProfile> findByEmail(String email) {
    if (email == null || email.isBlank()) {
      return Optional.empty();
    }
    return userProfileRepository.findByEmailIgnoreCase(email);
  }

  public CurrentUser requireRole(UserRole... allowedRoles) {
    CurrentUser user = requireCurrentUser();
    boolean allowed = Arrays.asList(allowedRoles).contains(user.role());
    if (!allowed) {
      throw new ForbiddenException("접근 권한이 없습니다.");
    }
    return user;
  }

  public Jwt currentJwt() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
      throw new UnauthorizedException("로그인이 필요합니다.");
    }
    return jwt;
  }
}
