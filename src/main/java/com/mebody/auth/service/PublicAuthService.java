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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
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
  /** 확인 메일의 링크가 돌아올 주소. 비우면 Supabase 대시보드의 Site URL 로 갑니다. */
  private final String appUrl;

  public PublicAuthService(SupabaseProperties supabaseProperties,
                           AuthSignupProperties authSignupProperties,
                           UserProfileRepository userProfileRepository,
                           ObjectMapper objectMapper,
                           JdbcTemplate jdbcTemplate,
                           @Value("${mebody.app-url:}") String appUrl) {
    this.appUrl = appUrl == null ? "" : appUrl.trim();
    this.supabaseProperties = supabaseProperties;
    this.authSignupProperties = authSignupProperties;
    this.userProfileRepository = userProfileRepository;
    this.objectMapper = objectMapper;
    this.jdbcTemplate = jdbcTemplate;
  }

  /**
   * 동의를 받은 약관·개인정보처리방침의 판.
   *
   * <p>값은 두 문서에 적힌 <b>시행일</b>입니다(static/terms.html · static/privacy.html).
   * <b>문서 본문을 고치면 이 값도 같이 올려야 합니다.</b> 안 올리면 새 문서에 대한 동의가
   * 옛 판으로 기록되어 증적이 틀어집니다.
   */
  private static final String LEGAL_POLICY_VERSION = "2026-07-22";

  @Transactional
  public PublicSignupResponse signup(PublicSignupRequest request) {
    SignupIdentifier id = SignupIdentifier.parse(request.resolvedIdentifier(), authSignupProperties.aliasDomain())
        .withRecoveryEmail(request.recoveryEmail());
    String displayName = normalize(request.displayName());

    // 기본 8자입니다. 되돌리려면 mebody.auth.min-password-length 만 바꾸면 됩니다.
    // **로그인에는 걸지 않습니다.** 걸면 기준을 올린 순간 기존 짧은 비밀번호 계정이 전부 잠깁니다.
    int minLength = authSignupProperties.minPasswordLengthOrDefault();
    if (request.password() == null || request.password().length() < minLength) {
      throw new ApiException(HttpStatus.BAD_REQUEST,
          minLength <= 1 ? "비밀번호를 입력해주세요." : "비밀번호는 " + minLength + "자 이상이어야 합니다.");
    }

    if (id.isPhone() && !authSignupProperties.phoneSignupAllowed()) {
      // 지금 휴대폰 가입은 SMS 가 아니라 이메일 별칭이라 번호 소유를 증명하지 못합니다.
      // 공개 모집 전에 이 길을 닫아 두기 위한 스위치입니다.
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "지금은 이메일로만 가입할 수 있습니다. 이메일 주소를 입력해주세요.");
    }
    if (id.isPhone() && authSignupProperties.phoneRecoveryEmailRequired()
        && (request.recoveryEmail() == null || request.recoveryEmail().isBlank())) {
      // 별칭 주소로는 재설정 메일을 받을 수 없습니다. 복구용 이메일이 없으면
      // 비밀번호를 잊는 순간 계정을 되찾을 방법이 아예 없습니다.
      throw new ApiException(HttpStatus.BAD_REQUEST,
          "휴대폰으로 가입하려면 복구용 이메일이 필요합니다. "
              + "비밀번호를 잊었을 때 재설정 메일을 받을 주소입니다.");
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
      // 확인 전에는 프로필 본문(이름·연락처)을 채우지 않습니다. 확인 뒤 첫 로그인에서 앱이 채웁니다.
      //
      // 다만 **동의 시각은 지금 남깁니다.** 동의는 확인 메일과 무관하게 이 순간에 실제로 한
      // 행위이고, 남기지 않으면 auth.users 에 사람은 생겼는데 동의 증적이 없는 상태가 됩니다.
      // (프로필 행 자체는 auth.users 의 on_auth_user_created 트리거가 이미 만들어 둡니다)
      recordConsent(created.id(), request);
      return new PublicSignupResponse(created.id(), id.channel(), id.loginEmail(), displayName,
          true, "확인 메일을 보냈습니다. 메일함에서 링크를 열면 로그인할 수 있어요.", false);
    }

    saveProfile(created.id(), id, displayName);
    recordConsent(created.id(), request);
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

    // 확인 절차가 켜져 있으면 이 경로로 풀어주지 않습니다. 여기로 우회가 되면 확인 절차를
    // 켜 놓으나 꺼 놓으나 같아집니다.
    //
    // 예전에는 `!id.isPhone() &&` 가 붙어 있어서 **휴대폰 식별자는 검사를 통째로 건너뛰었습니다.**
    // 즉 MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=true 로 켜 두어도, 번호를 이 엔드포인트에
    // 그냥 보내면 확인 없이 승인됐습니다. 식별자 종류에 맞는 스위치를 봅니다.
    boolean verificationOn = id.isPhone()
        ? authSignupProperties.phoneVerificationRequired()
        : authSignupProperties.emailVerificationRequired();
    if (verificationOn) {
      throw new ApiException(HttpStatus.CONFLICT, id.isPhone()
          ? "휴대폰 인증 절차가 켜져 있습니다. 문자로 받은 인증번호로 확인해주세요."
          : "이메일 확인 절차가 켜져 있습니다. 메일함의 링크를 열어주세요.");
    }

    // 여기서부터는 **계정이 있든 없든 응답이 같습니다.** 응답이 갈리면 이메일·번호를 하나씩
    // 넣어 보는 것만으로 회원 여부를 알아낼 수 있습니다(/reset 은 처음부터 이 규칙이었습니다).
    findAuthUserByEmail(id.loginEmail()).ifPresent(user -> {
      Boolean confirmed = jdbcTemplate.queryForObject(
          "select email_confirmed_at is not null from auth.users where id = ?", Boolean.class, user.id());
      if (Boolean.TRUE.equals(confirmed)) return;

      Map<String, Object> payload = new HashMap<>();
      payload.put("email_confirm", true);
      if (id.isPhone()) payload.put("phone_confirm", true);
      updateAuthUser(user.id(), payload);
    });

    return new AccountApprovalResponse(true, id.loginEmail());
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

  /**
   * 번호로 로그인.
   *
   * <p>복구 이메일을 적고 가입하면 계정의 이메일이 별칭이 아니라 그 주소입니다. 그래서 앱이
   * 번호를 별칭으로 바꿔 보내는 방식만으로는 로그인할 수 없습니다. 서버가 auth.users.phone 으로
   * 계정을 찾아 비밀번호까지 확인한 뒤 세션을 돌려줍니다.
   *
   * <p>번호 → 이메일을 그냥 알려주지 않는 이유는, 그러면 누구나 번호로 이메일을 캐낼 수 있기
   * 때문입니다. 비밀번호가 맞을 때만 세션이 나갑니다.
   */
  public JsonNode loginByPhone(String identifier, String password) {
    SignupIdentifier id = SignupIdentifier.parse(identifier, authSignupProperties.aliasDomain());
    if (!id.isPhone()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "휴대폰 번호를 입력해주세요.");
    }

    // 번호로 찾고, 없으면 별칭 이메일로 한 번 더 찾습니다(복구 이메일 없이 가입한 계정).
    String loginEmail = jdbcTemplate.query(
        "select email from auth.users where phone = ? limit 1",
        ps -> ps.setString(1, id.phoneE164().replace("+", "")),
        rs -> rs.next() ? rs.getString("email") : null);
    if (loginEmail == null) loginEmail = id.loginEmail();

    Map<String, Object> payload = new HashMap<>();
    payload.put("email", loginEmail);
    payload.put("password", password);
    return callAuth("/auth/v1/token?grant_type=password", payload, false);
  }

  /**
   * 번호로 비밀번호 재설정 요청.
   *
   * <p>계정이 있든 없든, 복구 이메일이 있든 없든 **같은 응답**을 돌려줍니다.
   * 응답이 갈리면 번호만 넣어 가입 여부를 알아낼 수 있습니다.
   */
  public void requestPhonePasswordReset(String identifier, String redirectTo) {
    SignupIdentifier id;
    try {
      id = SignupIdentifier.parse(identifier, authSignupProperties.aliasDomain());
    } catch (ApiException e) {
      return; // 형식이 틀려도 있는 척/없는 척 하지 않습니다
    }
    if (!id.isPhone()) return;

    String email = jdbcTemplate.query(
        "select email from auth.users where phone = ? limit 1",
        ps -> ps.setString(1, id.phoneE164().replace("+", "")),
        rs -> rs.next() ? rs.getString("email") : null);

    // 메일함이 없는 별칭 주소로는 보내지 않습니다. 보내봐야 아무 데도 닿지 않습니다.
    if (email == null || email.endsWith("@" + authSignupProperties.aliasDomain())) return;

    Map<String, Object> payload = new HashMap<>();
    payload.put("email", email);
    String path = redirectTo == null || redirectTo.isBlank()
        ? "/auth/v1/recover"
        : "/auth/v1/recover?redirect_to=" + java.net.URLEncoder.encode(redirectTo, java.nio.charset.StandardCharsets.UTF_8);
    try {
      callAuth(path, payload, false);
    } catch (ApiException e) {
      // 실패해도 같은 응답을 주기 위해 삼킵니다. 로그로만 남깁니다.
      System.err.println("[auth] 번호 기반 재설정 메일 발송 실패: " + e.getMessage());
    }
  }

  /**
   * 동의한 사실을 남깁니다.
   *
   * <p>가입 화면에 체크박스는 있는데 어디에도 기록되지 않고 있었습니다.
   * 분쟁이 생기면 "동의를 받았다" 를 증명할 방법이 없습니다.
   * 컬럼이 아직 없는 DB(055 미적용)에서는 조용히 지나갑니다. 가입은 막지 않습니다.
   */
  private void recordConsent(UUID authUserId, PublicSignupRequest request) {
    boolean terms     = Boolean.TRUE.equals(request.agreedTerms());
    boolean privacy   = Boolean.TRUE.equals(request.agreedPrivacy());
    boolean marketing = Boolean.TRUE.equals(request.agreedMarketing());
    if (!terms && !privacy && !marketing) return;

    try {
      jdbcTemplate.update(
          "UPDATE public.user_profiles"
              + "   SET terms_agreed_at     = CASE WHEN ? THEN now() ELSE terms_agreed_at END,"
              + "       privacy_agreed_at   = CASE WHEN ? THEN now() ELSE privacy_agreed_at END,"
              + "       marketing_agreed_at = CASE WHEN ? THEN now() ELSE marketing_agreed_at END,"
              + "       marketing_opt_in    = CASE WHEN ? THEN true ELSE marketing_opt_in END,"
              + "       updated_at = now()"
              + " WHERE id = ? OR auth_user_id = ?",
          terms, privacy, marketing, marketing, authUserId, authUserId);
    } catch (org.springframework.dao.DataAccessException e) {
      String message = String.valueOf(e.getMostSpecificCause().getMessage());
      if (message.contains("does not exist")) {
        // 055 미적용. 가입 자체는 성공했으므로 막지 않습니다.
        System.err.println("[auth] 동의 시각을 남기지 못했습니다(055 미적용): " + message);
        return;
      }
      throw e;
    }

    // 원장에도 남깁니다(071). 컬럼은 "지금 동의 상태" 고 원장은 "무엇에 언제 동의했나" 입니다.
    // 문서를 고치면 컬럼의 시각만으로는 어느 판에 대한 동의였는지 알 수 없습니다.
    recordConsentLedger(authUserId, terms, privacy, marketing);
  }

  /**
   * 동의 원장 한 줄씩 (071 · 2026-09-22 감사 P1-1).
   *
   * <p>원장에 직접 INSERT 하지 않고 {@code record_consent()} 를 거칩니다 — 테이블에는
   * 아무에게도 INSERT 권한이 없습니다. 앱이 직접 쓸 수 있으면 받지 않은 동의를 남길 수 있고,
   * 그러면 증적의 의미가 없어집니다.
   *
   * <p><b>실패해도 가입을 막지 않습니다.</b> 071 미적용 서버에서도 가입은 되어야 합니다.
   * 대신 표준 오류로 남겨 적용을 잊지 않게 합니다.
   */
  private void recordConsentLedger(UUID authUserId, boolean terms, boolean privacy, boolean marketing) {
    // SAVEPOINT 로 감쌉니다. **Java 에서 예외를 잡아도 Postgres 트랜잭션은 이미 abort 입니다.**
    // 그대로 두면 이 실패가 위의 동의 시각 UPDATE 까지 되돌려 버립니다(실제로 그랬습니다).
    // 071 미적용 서버에서도 가입과 동의 시각은 정상이어야 합니다.
    try {
      jdbcTemplate.execute("SAVEPOINT consent_ledger");
    } catch (org.springframework.dao.DataAccessException e) {
      return;  // 세이브포인트를 못 잡으면 시도하지 않습니다. 위 기록을 지킵니다.
    }

    UUID profileId = userProfileRepository.findByAuthUserId(authUserId)
        .map(UserProfile::getId).orElse(authUserId);
    record Item(boolean agreed, String type) {}
    try {
      for (Item item : new Item[]{
          new Item(terms, "terms"),
          new Item(privacy, "privacy"),
          new Item(marketing, "marketing")}) {
        if (!item.agreed()) continue;
        jdbcTemplate.queryForObject(
            "SELECT public.record_consent(?, NULL, ?, ?, 'server')",
            UUID.class, profileId, item.type(), LEGAL_POLICY_VERSION);
      }
      jdbcTemplate.execute("RELEASE SAVEPOINT consent_ledger");
    } catch (org.springframework.dao.DataAccessException e) {
      jdbcTemplate.execute("ROLLBACK TO SAVEPOINT consent_ledger");
      System.err.println("[auth] 동의 원장 기록 실패(071 미적용일 수 있음): "
          + e.getMostSpecificCause().getMessage());
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

    // redirect_to 를 안 보내면 확인 링크가 Supabase 대시보드의 Site URL 로 갑니다.
    // 그 값은 우리 저장소에 없어서 코드만 보고는 어디로 가는지 알 수 없습니다.
    // 여기서 명시해 두면 확인을 마친 사람이 항상 우리 앱으로 돌아옵니다.
    // (그 주소가 Supabase 의 Redirect URLs 허용 목록에 있어야 합니다)
    JsonNode body = callAuth("/auth/v1/signup" + redirectQuery(), payload, false);
    JsonNode user = body.has("user") ? body.path("user") : body;
    return new AuthUser(UUID.fromString(user.path("id").asText()), user.path("email").asText(id.loginEmail()));
  }

  /** 확인 메일 링크가 돌아올 주소를 쿼리로 붙입니다. 설정이 비어 있으면 아무것도 붙이지 않습니다. */
  private String redirectQuery() {
    if (appUrl.isBlank()) return "";
    return "?redirect_to=" + URLEncoder.encode(appUrl, StandardCharsets.UTF_8);
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
        // 길이 기준은 Supabase 프로젝트 설정이 정합니다(실측 시점 6자).
        // 숫자를 여기 적어두면 설정을 바꿀 때마다 문구가 어긋나므로 적지 않습니다.
        throw new ApiException(HttpStatus.BAD_REQUEST, "비밀번호가 너무 짧습니다. 조금 더 길게 입력해주세요.");
      }
      if ("email_address_invalid".equals(code)) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "사용할 수 없는 이메일 주소입니다.");
      }
      // Supabase 기본 SMTP 는 시간당 몇 통으로 막혀 있습니다. 확인 메일을 켜 둔 채로
      // 이걸 만나면 **가입 자체가 안 됩니다.** 외부 가입자를 받기 전에 자체 SMTP 를 붙이세요
      // (Authentication → Emails). 원문을 그대로 보여주면 사용자는 무슨 말인지 모릅니다.
      // Supabase 의 한도는 한 종류가 아닙니다. 메일 발송(over_email_send_rate_limit) 말고도
      // 요청 수(over_request_rate_limit) 등이 있고, 앞으로 더 생길 수 있습니다.
      // **상태 코드 429 자체를 기준으로 잡습니다.** 코드 이름만 나열하면 새 한도가 생길 때마다
      // 502 "Supabase Auth 회원 생성 실패: ..." 라는 원문이 사용자에게 그대로 나갑니다.
      if (response.statusCode() == 429
          || "over_email_send_rate_limit".equals(code)
          || "over_request_rate_limit".equals(code)
          || message.toLowerCase().contains("rate limit")) {
        boolean mail = "over_email_send_rate_limit".equals(code)
            || message.toLowerCase().contains("email rate limit");
        throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, mail
            ? "지금은 확인 메일을 보낼 수 없습니다. 잠시 후 다시 시도해주세요."
            : "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.");
      }
      // 로그인 실패는 게이트웨이 문제가 아니라 자격 증명 문제입니다. 502 로 뭉개면
      // 앱이 "서버 오류" 로 안내하게 되어 사용자가 무엇을 고쳐야 할지 모릅니다.
      // 확인 메일을 아직 안 연 상태입니다. "비밀번호가 틀렸다" 로 뭉개면 사용자가
      // 맞는 비밀번호를 계속 다시 칩니다.
      if ("email_not_confirmed".equals(code)) {
        throw new ApiException(HttpStatus.CONFLICT,
            "가입 확인이 아직 끝나지 않았습니다. 확인 메일의 링크를 열어주세요.");
      }
      if ("invalid_credentials".equals(code) || response.statusCode() == 400 || response.statusCode() == 401) {
        throw new ApiException(HttpStatus.UNAUTHORIZED, "휴대폰 번호 또는 비밀번호가 올바르지 않습니다.");
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
