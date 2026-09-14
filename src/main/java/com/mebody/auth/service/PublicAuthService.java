package com.mebody.auth.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mebody.auth.config.AuthSignupProperties;
import com.mebody.auth.dto.AccountApprovalResponse;
import com.mebody.auth.dto.PublicSignupRequest;
import com.mebody.auth.dto.PublicSignupResponse;
import com.mebody.auth.dto.SignupIdentifier;
import com.mebody.common.exception.ApiException;
import com.mebody.common.security.SupabaseProperties;
import com.mebody.user.domain.UserProfile;
import com.mebody.user.repository.UserProfileRepository;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회원가입.
 *
 * <p>앱이 Supabase 로 직접 가입하지 않고 여기를 거치는 이유는 하나입니다.
 * Supabase 프로젝트의 Confirm email 이 켜져 있어서, 앱에서 그냥 가입하면 확인 메일을 열기 전까지
 * 로그인이 막힙니다(실측: {@code email_not_confirmed}). 서비스 롤 키는 앱에 둘 수 없으므로
 * 확인 상태로 계정을 만드는 일은 서버만 할 수 있습니다.
 *
 * <p>확인 절차를 켜고 끄는 값은 {@link AuthSignupProperties} 에 있습니다.
 * 지금은 이메일·휴대폰 둘 다 가입 즉시 이용이고, 값만 바꾸면 확인 절차가 켜집니다.
 */
@Service
public class PublicAuthService {
  private final SupabaseProperties supabaseProperties;
  private final AuthSignupProperties authSignupProperties;
  private final UserProfileRepository userProfileRepository;
  private final ObjectMapper objectMapper;
  private final JdbcTemplate jdbcTemplate;
  private final HttpClient httpClient = HttpClient.newHttpClient();

  public PublicAuthService(SupabaseProperties supabaseProperties,
                           AuthSignupProperties authSignupProperties,
                           UserProfileRepository userProfileRepository,
                           ObjectMapper objectMapper,
                           JdbcTemplate jdbcTemplate) {
    this.supabaseProperties = supabaseProperties;
    this.authSignupProperties = authSignupProperties;
    this.userProfileRepository = userProfileRepository;
    this.objectMapper = objectMapper;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Transactional
  public PublicSignupResponse signup(PublicSignupRequest request) {
    SignupIdentifier id = SignupIdentifier.parse(request.resolvedIdentifier(), authSignupProperties.aliasDomain());
    String displayName = normalize(request.displayName());

    // 지금은 최소 1자입니다. 조건을 올리려면 mebody.auth.min-password-length 만 바꾸면 됩니다.
    int minLength = authSignupProperties.minPasswordLengthOrDefault();
    if (request.password() == null || request.password().length() < minLength) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          minLength <= 1 ? "비밀번호를 입력해주세요." : "비밀번호는 " + minLength + "자 이상이어야 합니다.");
    }

    if (id.isPhone() && authSignupProperties.phoneNativeMode()) {
      // 번호 자체로 가입하는 방식. Supabase 에 SMS 제공자를 연결해야 동작합니다.
      throw new ApiException(HttpStatus.NOT_IMPLEMENTED,
          "휴대폰 번호 방식(native)은 Supabase 전화 제공자 연결이 필요합니다. "
              + "연결 전까지는 MEBODY_AUTH_PHONE_MODE=alias 로 두세요.");
    }
    if (id.isPhone() && authSignupProperties.phoneVerificationRequired()) {
      throw new ApiException(HttpStatus.NOT_IMPLEMENTED,
          "휴대폰 인증은 SMS 제공자를 붙인 뒤에 켤 수 있습니다. "
              + "MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=false 로 두면 지금처럼 가입 즉시 이용됩니다.");
    }

    Optional<AuthUser> existing = findAuthUserByEmail(id.loginEmail());
    if (existing.isPresent()) {
      // 비밀번호를 확인하지 않았으므로 기존 계정에는 아무것도 쓰지 않습니다.
      // 앱은 이 응답을 받고 로그인 화면 흐름으로 넘어갑니다.
      return new PublicSignupResponse(existing.get().id(), id.channel(), id.loginEmail(), displayName,
          false, null, true);
    }

    boolean verifyEmail = !id.isPhone() && authSignupProperties.emailVerificationRequired();
    AuthUser created = verifyEmail
        ? signUpAndSendVerification(id, request.password(), displayName)
        : createConfirmedUser(id, request.password(), displayName);

    if (verifyEmail) {
      // 확인 전에는 프로필을 만들지 않습니다. 확인 뒤 첫 로그인에서 앱이 만듭니다.
      return new PublicSignupResponse(created.id(), id.channel(), id.loginEmail(), displayName,
          true, "확인 메일을 보냈습니다. 메일함에서 링크를 열면 로그인할 수 있어요.", false);
    }

    saveProfile(created.id(), id, displayName);
    return new PublicSignupResponse(created.id(), id.channel(), id.loginEmail(), displayName, false, null, false);
  }

  /**
   * 승인 대기로 남은 계정을 풀어줍니다.
   *
   * <p>가입은 서버를 거치면 항상 승인된 상태로 만들어집니다. 그런데 두 경로가 남아 있습니다.
   * 서버에 못 붙었을 때 앱이 Supabase 로 직접 가입하는 폴백, 그리고 예전에 인증 메일 방식으로
   * 가입해 둔 계정입니다. 그런 계정은 로그인할 때 {@code email_not_confirmed} 로 막힙니다.
   * 그때 호출부가 이 함수를 부르고 다시 로그인하면 됩니다.
   *
   * <p>승인만 할 뿐 로그인을 시켜주지는 않습니다. 비밀번호는 여전히 맞아야 합니다.
   * 확인 절차를 다시 켜면({@code require-email-verification=true}) 이 경로는 거절합니다.
   */
  public AccountApprovalResponse approve(String identifier) {
    SignupIdentifier id = SignupIdentifier.parse(identifier, authSignupProperties.aliasDomain());

    if (!id.isPhone() && authSignupProperties.emailVerificationRequired()) {
      throw new ApiException(HttpStatus.CONFLICT,
          "이메일 확인 절차가 켜져 있습니다. 메일함의 링크를 열어주세요.");
    }

    Optional<AuthUser> found = findAuthUserByEmail(id.loginEmail());
    if (found.isEmpty()) {
      return new AccountApprovalResponse(false, false, false, id.loginEmail());
    }

    UUID userId = found.get().id();
    Boolean confirmed = jdbcTemplate.queryForObject(
        "select email_confirmed_at is not null from auth.users where id = ?", Boolean.class, userId);
    if (Boolean.TRUE.equals(confirmed)) {
      return new AccountApprovalResponse(true, false, true, id.loginEmail());
    }

    Map<String, Object> payload = new HashMap<>();
    payload.put("email_confirm", true);
    if (id.isPhone()) payload.put("phone_confirm", true);
    updateAuthUser(userId, payload);

    return new AccountApprovalResponse(true, true, false, id.loginEmail());
  }

  private void updateAuthUser(UUID userId, Map<String, Object> payload) {
    String serviceRoleKey = supabaseProperties.serviceRoleKey();
    if (serviceRoleKey == null || serviceRoleKey.isBlank()) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다.");
    }

    try {
      HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(projectUrl() + "/auth/v1/admin/users/" + userId))
          .method("PUT", HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
          .header("Authorization", "Bearer " + serviceRoleKey)
          .header("apikey", serviceRoleKey)
          .header("Content-Type", "application/json")
          .build();
      HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() >= 200 && response.statusCode() < 300) return;

      JsonNode body = objectMapper.readTree(response.body());
      throw new ApiException(HttpStatus.BAD_GATEWAY, "계정 승인에 실패했습니다: "
          + body.path("msg").asText(body.path("message").asText(String.valueOf(response.statusCode()))));
    } catch (ApiException e) {
      throw e;
    } catch (IOException e) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Supabase Auth 요청을 처리하지 못했습니다.");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Supabase Auth 요청이 중단되었습니다.");
    }
  }

  private void saveProfile(UUID authUserId, SignupIdentifier id, String displayName) {
    String email = id.loginEmail();
    UserProfile profile = userProfileRepository.findByAuthUserId(authUserId)
        .or(() -> userProfileRepository.findByEmailIgnoreCase(email))
        .orElseGet(() -> UserProfile.newMember(authUserId, email));

    if (profile.getId() == null) profile.setId(authUserId);
    profile.setAuthUserId(authUserId);
    profile.setEmail(email);
    if (displayName != null) {
      profile.setDisplayName(displayName);
      profile.setName(displayName);
    }
    userProfileRepository.save(profile);
  }

  /** 확인 상태로 바로 만듭니다. 메일도 SMS 도 나가지 않습니다. */
  private AuthUser createConfirmedUser(SignupIdentifier id, String password, String displayName) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("email", id.loginEmail());
    payload.put("password", password);
    payload.put("email_confirm", true);
    if (id.isPhone()) {
      // 나중에 전화 제공자를 켤 때 그대로 쓸 수 있도록 번호도 같이 넣어 둡니다.
      payload.put("phone", id.phoneE164());
      payload.put("phone_confirm", true);
    }

    Map<String, Object> meta = new LinkedHashMap<>();
    meta.put("display_name", displayName == null ? "" : displayName);
    meta.put("signup_channel", id.channel());
    if (id.isPhone()) meta.put("phone_number", id.phoneLocal());
    payload.put("user_metadata", meta);

    JsonNode body = callAuth("/auth/v1/admin/users", payload, true);
    return new AuthUser(UUID.fromString(body.path("id").asText()), body.path("email").asText(id.loginEmail()));
  }

  /** 확인 절차를 켰을 때. Supabase 가 확인 메일을 보내고, 열기 전까지는 로그인이 막힙니다. */
  private AuthUser signUpAndSendVerification(SignupIdentifier id, String password, String displayName) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("email", id.loginEmail());
    payload.put("password", password);
    payload.put("data", Map.of("display_name", displayName == null ? "" : displayName,
        "signup_channel", id.channel()));

    JsonNode body = callAuth("/auth/v1/signup", payload, false);
    JsonNode user = body.has("user") ? body.path("user") : body;
    return new AuthUser(UUID.fromString(user.path("id").asText()), user.path("email").asText(id.loginEmail()));
  }

  private JsonNode callAuth(String path, Map<String, Object> payload, boolean asServiceRole) {
    String key = asServiceRole ? supabaseProperties.serviceRoleKey() : supabaseProperties.anonKey();
    if (key == null || key.isBlank()) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
          (asServiceRole ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY") + "가 설정되어 있지 않습니다.");
    }

    try {
      HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(projectUrl() + path))
          .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
          .header("Authorization", "Bearer " + key)
          .header("apikey", key)
          .header("Content-Type", "application/json")
          .build();
      HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
      JsonNode body = objectMapper.readTree(response.body());
      if (response.statusCode() >= 200 && response.statusCode() < 300) return body;

      String message = body.path("msg").asText(body.path("message").asText("회원가입 처리에 실패했습니다."));
      String code = body.path("error_code").asText("");
      if ("email_exists".equals(code) || "user_already_exists".equals(code) || message.toLowerCase().contains("already")) {
        throw new ApiException(HttpStatus.CONFLICT, "이미 가입된 계정입니다. 로그인으로 진행해주세요.");
      }
      if ("weak_password".equals(code)) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "비밀번호가 너무 단순합니다. 8자 이상으로 다시 입력해주세요.");
      }
      if ("email_address_invalid".equals(code)) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "사용할 수 없는 이메일 주소입니다.");
      }
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Supabase Auth 회원 생성 실패: " + message);
    } catch (ApiException e) {
      throw e;
    } catch (IOException e) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Supabase Auth 요청을 처리하지 못했습니다.");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Supabase Auth 요청이 중단되었습니다.");
    }
  }

  private Optional<AuthUser> findAuthUserByEmail(String email) {
    return jdbcTemplate.query(
        "select id, email from auth.users where lower(email) = lower(?) limit 1",
        ps -> ps.setString(1, email),
        rs -> {
          if (!rs.next()) return Optional.empty();
          return Optional.of(new AuthUser(rs.getObject("id", UUID.class), rs.getString("email")));
        }
    );
  }

  private String projectUrl() {
    String url = supabaseProperties.url();
    if (url != null && !url.isBlank()) return url.replaceAll("/+$", "");
    String jwksUrl = supabaseProperties.jwksUrl();
    if (jwksUrl != null && jwksUrl.contains("/auth/")) {
      return jwksUrl.substring(0, jwksUrl.indexOf("/auth/")).replaceAll("/+$", "");
    }
    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SUPABASE_URL 또는 SUPABASE_JWKS_URL 설정이 필요합니다.");
  }

  private String normalize(String value) {
    if (value == null) return null;
    String trimmed = value.trim();
    return trimmed.isBlank() ? null : trimmed;
  }

  private record AuthUser(UUID id, String email) {
  }
}
