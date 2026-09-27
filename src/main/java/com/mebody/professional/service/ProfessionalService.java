package com.mebody.professional.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mebody.common.exception.ApiException;
import com.mebody.common.security.CurrentUser;
import com.mebody.common.security.CurrentUserService;
import com.mebody.common.security.UserScopedDb;
import com.mebody.professional.dto.AcceptInviteResponse;
import com.mebody.professional.dto.AssignMissionRequest;
import com.mebody.professional.dto.AssignableContent;
import com.mebody.professional.dto.ClientListItem;
import com.mebody.professional.dto.ClientJourneyResponse;
import com.mebody.professional.dto.ClientResultResponse;
import com.mebody.professional.dto.CreateInviteResponse;
import com.mebody.professional.dto.InvitePreviewResponse;
import com.mebody.professional.dto.IssueProfessionalRequest;
import com.mebody.professional.dto.MyProfessionalItem;
import com.mebody.professional.dto.ProfessionalProfileResponse;
import com.mebody.user.domain.UserRole;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 전문가 확장 Phase 1 — 계정·초대·결과 열람.
 *
 * <h2>권한을 어디서 판단하는가</h2>
 * "지금 로그인한 사람이 활성 전문가인가" 는 {@code current_professional_id()} 가, "이 전문가가
 * 이 고객을 볼 수 있는가" 는 {@code get_client_response()} 가 판단합니다. 둘 다 DB 함수입니다.
 * 서버는 {@link UserScopedDb} 로 검증된 토큰의 subject 를 심고 그 함수를 부를 뿐, 같은 판단을
 * Java 로 다시 구현하지 않습니다. 두 벌이 되면 언젠가 갈라지고, 갈라지는 쪽이 늘 느슨한 쪽입니다.
 *
 * <h2>동의가 없으면 아무것도 없다</h2>
 * 초대(INVITED)는 관계가 아닙니다. 고객이 직접 눌러 {@code consented_at} 이 찍혀야 결과가 보입니다.
 * 동의 전에는 "결과가 있는지" 조차 알려주지 않습니다 — 그것도 그 사람에 대한 정보입니다.
 * 그리고 고객은 언제든 동의를 거둘 수 있습니다({@link #withdrawConsent}). 거둘 수 없는 동의는
 * 동의가 아닙니다.
 */
@Service
public class ProfessionalService {
  private final CurrentUserService currentUserService;
  private final UserScopedDb userScopedDb;
  private final JdbcTemplate jdbcTemplate;
  private final ObjectMapper objectMapper;
  private final String appUrl;

  public ProfessionalService(CurrentUserService currentUserService,
                             UserScopedDb userScopedDb,
                             JdbcTemplate jdbcTemplate,
                             ObjectMapper objectMapper,
                             @Value("${mebody.app-url:https://mebody-jjh.vercel.app}") String appUrl) {
    this.currentUserService = currentUserService;
    this.userScopedDb = userScopedDb;
    this.jdbcTemplate = jdbcTemplate;
    this.objectMapper = objectMapper;
    this.appUrl = appUrl == null || appUrl.isBlank() ? "https://mebody-jjh.vercel.app" : appUrl.trim();
  }

  // ───────────────────────────────────────────────────────────── 전문가 본인

  public ProfessionalProfileResponse myProfile() {
    CurrentUser me = currentUserService.requireCurrentUser();
    UUID proId = requireProfessionalId(me);

    return jdbcTemplate.query(
        "SELECT pr.id, pr.type, coalesce(pr.display_name, p.display_name, '') AS name, pr.status"
            + "  FROM public.professionals pr"
            + "  JOIN public.user_profiles p ON p.id = pr.user_profile_id"
            + " WHERE pr.id = ?",
        rs -> rs.next()
            ? new ProfessionalProfileResponse(
                UUID.fromString(rs.getString("id")), rs.getString("type"),
                rs.getString("name"), rs.getString("status"))
            : null,
        proId);
  }

  // ───────────────────────────────────────────────────────────── 초대

  public CreateInviteResponse createInvite() {
    CurrentUser me = currentUserService.requireCurrentUser();
    requireProfessionalId(me);
    UUID authUserId = me.authUserId() != null ? me.authUserId() : me.id();

    // 토큰 생성과 "초대를 보냈다" 기록을 한 트랜잭션에서 합니다(068).
    // 여기서 따로 INSERT 하면 한쪽만 성공하는 순간이 생기고, 주지표가 조용히 어긋납니다.
    return userScopedDb.as(authUserId, con -> {
      try (PreparedStatement ps = con.prepareStatement(
          "SELECT relation_id, invite_token, expires_at FROM public.create_client_invite()");
           ResultSet rs = ps.executeQuery()) {
        if (!rs.next()) throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "초대를 만들지 못했습니다.");
        return new CreateInviteResponse(
            UUID.fromString(rs.getString("relation_id")),
            inviteUrl(rs.getString("invite_token")),
            offset(rs.getTimestamp("expires_at")));
      }
    });
  }

  /**
   * 로그인 전에 보여줄 미리보기. 토큰을 아는 사람에게만 전문가 이름을 알려줍니다.
   *
   * <p>이미 수락된 토큰은 유효하지 않다고 답합니다. 수락 뒤에도 유효하면 링크를 받은 다른
   * 사람이 같은 토큰으로 자기 계정을 묶을 수 있습니다(1회용).
   */
  public InvitePreviewResponse previewInvite(String token) {
    if (token == null || token.isBlank()) return InvitePreviewResponse.invalid("링크가 올바르지 않습니다.");

    return jdbcTemplate.query(
        "SELECT pc.status, pc.expires_at, pc.client_user_id,"
            + "       coalesce(pr.display_name, p.display_name, '전문가') AS name, pr.type, pr.status AS pro_status"
            + "  FROM public.professional_clients pc"
            + "  JOIN public.professionals pr ON pr.id = pc.professional_id"
            + "  JOIN public.user_profiles p  ON p.id = pr.user_profile_id"
            + " WHERE pc.invite_token = ?",
        rs -> {
          // 없는 토큰과 만료된 토큰의 답을 같게 둡니다. 다르면 토큰을 넣어 보며
          // "이 전문가가 초대를 보냈다" 는 사실을 캐낼 수 있습니다.
          if (!rs.next()) return InvitePreviewResponse.invalid("만료되었거나 사용할 수 없는 링크입니다.");
          String status = rs.getString("status");
          OffsetDateTime expiresAt = offset(rs.getTimestamp("expires_at"));
          boolean usable = "INVITED".equals(status)
              && rs.getString("client_user_id") == null
              && "ACTIVE".equals(rs.getString("pro_status"))
              && expiresAt != null && expiresAt.isAfter(OffsetDateTime.now());
          if (!usable) return InvitePreviewResponse.invalid("만료되었거나 사용할 수 없는 링크입니다.");
          return new InvitePreviewResponse(true, null, rs.getString("name"), rs.getString("type"), expiresAt);
        },
        token);
  }

  /** 고객이 "내 결과를 보여주겠다" 를 누릅니다. 로그인한 본인만 자기를 묶을 수 있습니다. */
  public AcceptInviteResponse acceptInvite(String token) {
    CurrentUser me = currentUserService.requireCurrentUser();
    if (token == null || token.isBlank()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "링크가 올바르지 않습니다.");
    }

    // 조건을 전부 UPDATE 의 WHERE 에 둡니다. 읽고 나서 쓰면 그 사이에 같은 토큰이
    // 두 번 수락될 수 있습니다(1회용이 깨집니다).
    Integer updated = jdbcTemplate.update(
        "UPDATE public.professional_clients"
            + "   SET client_user_id = ?, status = 'ACTIVE', consented_at = now(), updated_at = now()"
            + " WHERE invite_token = ?"
            + "   AND status = 'INVITED'"
            + "   AND client_user_id IS NULL"
            + "   AND expires_at > now()"
            + "   AND professional_id IN (SELECT id FROM public.professionals WHERE status = 'ACTIVE')",
        me.id(), token);

    if (updated == null || updated == 0) {
      throw new ApiException(HttpStatus.CONFLICT, "만료되었거나 이미 사용된 링크입니다.");
    }

    return jdbcTemplate.query(
        "SELECT pc.id, pc.consented_at, coalesce(pr.display_name, p.display_name, '전문가') AS name,"
            + "       EXISTS (SELECT 1 FROM public.questionnaire_responses r"
            + "                WHERE r.user_id = ? AND r.status = 'completed') AS has_result"
            + "  FROM public.professional_clients pc"
            + "  JOIN public.professionals pr ON pr.id = pc.professional_id"
            + "  JOIN public.user_profiles p  ON p.id = pr.user_profile_id"
            + " WHERE pc.invite_token = ?",
        rs -> {
          if (!rs.next()) throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "동의를 저장하지 못했습니다.");
          return new AcceptInviteResponse(UUID.fromString(rs.getString("id")), rs.getString("name"),
              offset(rs.getTimestamp("consented_at")), rs.getBoolean("has_result"));
        },
        me.id(), token);
  }

  /**
   * 고객이 보는 "나와 연결된 전문가".
   *
   * <p>해지할 자리가 없으면 동의를 거둘 방법이 없고, 거둘 수 없는 동의는 동의가 아닙니다.
   * 끊은 관계(REVOKED)도 함께 보여줍니다 — 내가 언제 무엇을 허락했는지는 내 기록입니다.
   */
  public List<MyProfessionalItem> listMyProfessionals() {
    CurrentUser me = currentUserService.requireCurrentUser();
    return jdbcTemplate.query(
        "SELECT pc.id, pc.status, pc.consented_at, pr.type,"
            + "       coalesce(pr.display_name, p.display_name, '전문가') AS name"
            + "  FROM public.professional_clients pc"
            + "  JOIN public.professionals pr ON pr.id = pc.professional_id"
            + "  JOIN public.user_profiles p  ON p.id = pr.user_profile_id"
            + " WHERE pc.client_user_id = ?"
            + " ORDER BY pc.consented_at DESC NULLS LAST, pc.invited_at DESC",
        rs -> {
          List<MyProfessionalItem> rows = new ArrayList<>();
          while (rs.next()) {
            rows.add(new MyProfessionalItem(
                UUID.fromString(rs.getString("id")), rs.getString("name"), rs.getString("type"),
                rs.getString("status"), offset(rs.getTimestamp("consented_at"))));
          }
          return rows;
        },
        me.id());
  }

  /** 고객이 동의를 거둡니다. 이 순간부터 전문가는 0행을 받습니다. */
  public void withdrawConsent(UUID relationId) {
    CurrentUser me = currentUserService.requireCurrentUser();
    Integer updated = jdbcTemplate.update(
        "UPDATE public.professional_clients"
            + "   SET status = 'REVOKED', revoked_at = now(), consented_at = NULL, updated_at = now()"
            + " WHERE id = ? AND client_user_id = ? AND status <> 'REVOKED'",
        relationId, me.id());
    if (updated == null || updated == 0) {
      throw new ApiException(HttpStatus.NOT_FOUND, "해지할 연결을 찾지 못했습니다.");
    }
  }

  /** 전문가가 관계를 끊습니다. 자기 고객만 끊을 수 있습니다. */
  public void revokeClient(UUID relationId) {
    CurrentUser me = currentUserService.requireCurrentUser();
    UUID proId = requireProfessionalId(me);
    Integer updated = jdbcTemplate.update(
        "UPDATE public.professional_clients"
            + "   SET status = 'REVOKED', revoked_at = now(), consented_at = NULL, updated_at = now()"
            + " WHERE id = ? AND professional_id = ? AND status <> 'REVOKED'",
        relationId, proId);
    if (updated == null || updated == 0) {
      throw new ApiException(HttpStatus.NOT_FOUND, "해지할 연결을 찾지 못했습니다.");
    }
  }

  // ───────────────────────────────────────────────────────────── 고객

  public List<ClientListItem> listClients() {
    CurrentUser me = currentUserService.requireCurrentUser();
    UUID proId = requireProfessionalId(me);

    return jdbcTemplate.query(
        "SELECT pc.id, pc.client_user_id, pc.status, pc.invited_at, pc.consented_at, pc.expires_at,"
            + "       pc.invite_token, p.display_name,"
            // 동의하지 않았으면 코드도 내보내지 않습니다. 목록에서도 마찬가지입니다.
            + "       CASE WHEN pc.consented_at IS NOT NULL THEN ("
            + "         SELECT r.calculated_code FROM public.questionnaire_responses r"
            + "          WHERE r.user_id = pc.client_user_id AND r.status = 'completed'"
            + "          ORDER BY r.completed_at DESC NULLS LAST LIMIT 1) END AS body_code"
            + "  FROM public.professional_clients pc"
            + "  LEFT JOIN public.user_profiles p ON p.id = pc.client_user_id"
            + " WHERE pc.professional_id = ?"
            + " ORDER BY pc.invited_at DESC",
        rs -> {
          List<ClientListItem> rows = new ArrayList<>();
          while (rs.next()) {
            String status = rs.getString("status");
            OffsetDateTime expiresAt = offset(rs.getTimestamp("expires_at"));
            boolean pending = "INVITED".equals(status) && rs.getString("client_user_id") == null;
            boolean expired = pending && expiresAt != null && expiresAt.isBefore(OffsetDateTime.now());
            String clientId = rs.getString("client_user_id");
            rows.add(new ClientListItem(
                UUID.fromString(rs.getString("id")),
                clientId == null ? null : UUID.fromString(clientId),
                rs.getString("display_name"),
                status,
                offset(rs.getTimestamp("invited_at")),
                offset(rs.getTimestamp("consented_at")),
                expiresAt,
                expired,
                // 아직 안 쓴 초대에만 링크를 돌려줍니다. 수락 뒤에도 주면 그 링크로
                // 다른 계정을 묶을 수 있습니다.
                pending && !expired ? inviteUrl(rs.getString("invite_token")) : null,
                rs.getString("body_code")));
          }
          return rows;
        },
        proId);
  }

  /**
   * 고객 결과 1건.
   *
   * <p>여기서 관계를 직접 확인하지 않습니다. {@code get_client_response()} 가 확인합니다.
   * 관계가 없거나 동의가 없으면 그 함수가 0행을 돌려주고, 우리는 404 로 옮깁니다.
   * 내 고객이 아닌 id 를 넣어도 "없다" 는 답만 나옵니다.
   */
  public ClientResultResponse clientResult(UUID clientUserId) {
    CurrentUser me = currentUserService.requireCurrentUser();
    requireProfessionalId(me);
    UUID authUserId = me.authUserId() != null ? me.authUserId() : me.id();

    ClientResultResponse found = userScopedDb.as(authUserId, con -> {
      try (PreparedStatement ps = con.prepareStatement(
          "SELECT client_user_id, calculated_code, primary_identity,"
              + "       scoring_meta::text AS scoring_meta, completed_at"
              + "  FROM public.get_client_response(?)")) {
        ps.setObject(1, clientUserId);
        try (ResultSet rs = ps.executeQuery()) {
          if (!rs.next()) return null;
          JsonNode meta = null;
          String raw = rs.getString("scoring_meta");
          if (raw != null) {
            try {
              meta = objectMapper.readTree(raw);
            } catch (Exception ignored) {
              meta = null;
            }
          }
          return new ClientResultResponse(
              UUID.fromString(rs.getString("client_user_id")),
              null,
              rs.getString("calculated_code"),
              rs.getString("primary_identity"),
              meta,
              offset(rs.getTimestamp("completed_at")));
        }
      }
    });

    if (found == null) {
      throw new ApiException(HttpStatus.NOT_FOUND, "볼 수 있는 결과가 없습니다. 고객이 동의했는지 확인해주세요.");
    }

    String name = jdbcTemplate.query(
        "SELECT display_name FROM public.user_profiles WHERE id = ?",
        rs -> rs.next() ? rs.getString(1) : null, clientUserId);

    recordActivity(requireProfessionalId(me), clientUserId, "client_opened");
    return new ClientResultResponse(found.clientUserId(), name, found.calculatedCode(),
        found.primaryIdentity(), found.scoringMeta(), found.completedAt());
  }

  /**
   * 고객의 수행 기록 — 진행률·일자별 타임라인·피드백.
   *
   * <p>결과 조회와 마찬가지로 여기서 관계를 직접 확인하지 않습니다.
   * {@code get_client_journey_summary()} 가 확인하고, 통과하지 못하면 NULL 을 돌려줍니다.
   * 우리는 그 NULL 을 404 로 옮깁니다 — "내 고객이 아니다" 와 "없는 사람이다" 가 같은 답입니다.
   *
   * <p>루틴을 아직 시작하지 않은 고객은 NULL 이 아니라 {@code has_journey=false} 가 옵니다.
   * 둘을 같은 404 로 뭉개면 전문가가 "권한이 없나" 하고 헤매게 됩니다.
   */
  public ClientJourneyResponse clientJourney(UUID clientUserId) {
    CurrentUser me = currentUserService.requireCurrentUser();
    UUID proId = requireProfessionalId(me);
    UUID authUserId = me.authUserId() != null ? me.authUserId() : me.id();

    String json = userScopedDb.as(authUserId, con -> {
      try (PreparedStatement ps = con.prepareStatement(
          "SELECT public.get_client_journey_summary(?)::text")) {
        ps.setObject(1, clientUserId);
        try (ResultSet rs = ps.executeQuery()) {
          return rs.next() ? rs.getString(1) : null;
        }
      }
    });

    if (json == null) {
      throw new ApiException(HttpStatus.NOT_FOUND, "볼 수 있는 기록이 없습니다. 고객이 동의했는지 확인해주세요.");
    }

    JsonNode node;
    try {
      node = objectMapper.readTree(json);
    } catch (Exception e) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "수행 기록을 읽지 못했습니다.");
    }

    recordActivity(proId, clientUserId, "activity_viewed");
    return new ClientJourneyResponse(node.path("has_journey").asBoolean(false), node);
  }

  /**
   * 오늘 확인이 필요한 고객만 (Phase 5).
   *
   * <p>인자가 없습니다. 어떤 고객을 볼지는 DB 함수가 {@code auth.uid()} 로만 정합니다.
   * 전문가 id 를 파라미터로 받으면 남의 id 를 넣어 보는 길이 생깁니다. 권한 판단은
   * {@code get_client_attention_list()} 안에 한 벌만 있고 여기서 다시 쓰지 않습니다.
   *
   * <p>전문가가 아니면 함수가 NULL 을 돌려줍니다. 그때도 404 가 아니라 **빈 목록**입니다 —
   * 고객이 0명인 전문가와 구분이 되면 관계 유무를 떠볼 수 있습니다.
   */
  public JsonNode clientAttention() {
    CurrentUser me = currentUserService.requireCurrentUser();
    UUID proId = requireProfessionalId(me);
    UUID authUserId = me.authUserId() != null ? me.authUserId() : me.id();

    String json = userScopedDb.as(authUserId, con -> {
      try (PreparedStatement ps = con.prepareStatement(
          "SELECT public.get_client_attention_list()::text")) {
        try (ResultSet rs = ps.executeQuery()) {
          return rs.next() ? rs.getString(1) : null;
        }
      }
    });

    if (json == null) {
      return objectMapper.createObjectNode()
          .put("total", 0).put("attention", 0)
          .set("clients", objectMapper.createArrayNode());
    }

    JsonNode node;
    try {
      node = objectMapper.readTree(json);
    } catch (Exception e) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "주의 목록을 읽지 못했습니다.");
    }

    // 목록을 열었다는 사실만 남깁니다. 고객 한 명이 아니라 목록 전체라 client_user_id 는 없습니다.
    recordActivity(proId, null, "attention_viewed");
    return node;
  }

  /**
   * 전문가가 고객 화면을 열었다는 사실만 남깁니다. 본 내용은 남기지 않습니다.
   *
   * <p>"주간 활성 전문가 비율" 을 세려면 전문가별 행이 필요합니다. {@code analytics_events}(054)는
   * 개인 식별 값을 일부러 넣지 않는 테이블이라 여기에 쓸 수 없어서 따로 둡니다.
   *
   * <p>기록에 실패해도 조회는 막지 않습니다. 지표 때문에 상담이 멈추면 안 됩니다.
   */
  private void recordActivity(UUID professionalId, UUID clientUserId, String event) {
    try {
      jdbcTemplate.update(
          "INSERT INTO public.professional_activity_log (professional_id, client_user_id, event)"
              + " VALUES (?, ?, ?)",
          professionalId, clientUserId, event);
    } catch (org.springframework.dao.DataAccessException e) {
      // 056 미적용이면 테이블이 없습니다. 그래도 화면은 그대로 동작해야 합니다.
      System.err.println("[professional] 활동 기록 실패(056 미적용일 수 있음): "
          + e.getMostSpecificCause().getMessage());
    }
  }

  // ───────────────────────────────────────────────────────────── 배정 (Phase 3)

  /**
   * 전문가가 고를 수 있는 동작 목록.
   *
   * <p>라이브러리에 있는 것이 전부입니다. 새 동작을 만들 수 있게 하면 검증되지 않은 지시를
   * 남의 몸에 나르는 통로가 됩니다.
   */
  public List<AssignableContent> assignableContents() {
    CurrentUser me = currentUserService.requireCurrentUser();
    requireProfessionalId(me);
    UUID authUserId = me.authUserId() != null ? me.authUserId() : me.id();

    return userScopedDb.as(authUserId, con -> {
      try (PreparedStatement ps = con.prepareStatement("SELECT * FROM public.assignable_contents()");
           ResultSet rs = ps.executeQuery()) {
        List<AssignableContent> rows = new ArrayList<>();
        while (rs.next()) {
          rows.add(new AssignableContent(
              rs.getString("content_key"), rs.getString("display_name"), rs.getString("target_muscle"),
              rs.getString("release_title"), rs.getString("stretch_title"), rs.getString("caution")));
        }
        return rows;
      }
    });
  }

  /**
   * 고객에게 미션을 배정합니다.
   *
   * <p>권한·내용·개수 판단은 전부 {@code assign_client_mission()} 안에 있습니다. 여기서
   * 다시 검사하지 않습니다 — 두 벌이 되면 갈라지고, 갈라지는 쪽은 늘 느슨한 쪽입니다.
   * 함수가 던지는 SQLSTATE 를 사람이 읽을 수 있는 응답으로 옮기는 것만 합니다.
   */
  public UUID assignMission(UUID clientUserId, AssignMissionRequest request) {
    CurrentUser me = currentUserService.requireCurrentUser();
    requireProfessionalId(me);
    UUID authUserId = me.authUserId() != null ? me.authUserId() : me.id();

    try {
      return userScopedDb.as(authUserId, con -> {
        try (PreparedStatement ps = con.prepareStatement(
            "SELECT public.assign_client_mission(?, ?, ?)")) {
          ps.setObject(1, clientUserId);
          ps.setString(2, request.contentKey());
          ps.setString(3, request.note());
          try (ResultSet rs = ps.executeQuery()) {
            return rs.next() ? UUID.fromString(rs.getString(1)) : null;
          }
        }
      });
    } catch (org.springframework.dao.DataAccessException e) {
      throw translateAssign(e);
    }
  }

  /** 아직 시작하지 않은 자기 배정을 거둡니다. */
  public boolean cancelAssignment(UUID missionId) {
    CurrentUser me = currentUserService.requireCurrentUser();
    requireProfessionalId(me);
    UUID authUserId = me.authUserId() != null ? me.authUserId() : me.id();

    try {
      Boolean removed = userScopedDb.as(authUserId, con -> {
        try (PreparedStatement ps = con.prepareStatement(
            "SELECT public.cancel_client_assignment(?)")) {
          ps.setObject(1, missionId);
          try (ResultSet rs = ps.executeQuery()) {
            return rs.next() && rs.getBoolean(1);
          }
        }
      });
      return Boolean.TRUE.equals(removed);
    } catch (org.springframework.dao.DataAccessException e) {
      throw translateAssign(e);
    }
  }

  /**
   * DB 함수가 던진 사유를 HTTP 로 옮깁니다.
   *
   * <p>전부 500 으로 뭉개면 전문가는 "왜 안 되는지" 를 알 수 없습니다. 하루 한도에 걸린 것과
   * 내 고객이 아닌 것은 대응이 완전히 다릅니다.
   */
  private ApiException translateAssign(org.springframework.dao.DataAccessException e) {
    Throwable cause = e.getMostSpecificCause();
    String state = cause instanceof java.sql.SQLException sql ? sql.getSQLState() : "";
    String message = String.valueOf(cause.getMessage());
    // PostgreSQL 이 메시지 앞에 "ERROR: " 를 붙이고 뒤에 상세를 답니다. 첫 줄만 씁니다.
    String first = message.replaceFirst("^ERROR:\\s*", "").split("\\R", 2)[0];

    return switch (state) {
      case "42501" -> new ApiException(HttpStatus.FORBIDDEN, first);
      case "22023" -> new ApiException(HttpStatus.BAD_REQUEST, first);
      case "22001" -> new ApiException(HttpStatus.BAD_REQUEST, first);
      case "54000" -> new ApiException(HttpStatus.TOO_MANY_REQUESTS, first);
      default -> {
        if (message.contains("does not exist")) {
          yield new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "배정 기능이 아직 준비되지 않았습니다(059 미적용).");
        }
        yield new ApiException(HttpStatus.BAD_GATEWAY, "배정에 실패했습니다.");
      }
    };
  }

  /**
   * 규칙 엔진에 먹일 입력 한 덩어리 (Phase 4).
   *
   * <p>여기서 초안을 <b>계산하지 않습니다.</b> 계산은 콘솔 브라우저가 앱과 <b>같은 코드</b>로
   * 합니다({@code static/assets/journey-rules.js} — 앱의 journeyRules.ts 를 변환한 것).
   * 규칙을 Java 나 SQL 로 옮겨 적으면 같은 로직이 두 벌이 되고, 112개 테스트는 한쪽만 지킵니다.
   * 그러면 앱과 콘솔이 다른 걸 추천하게 됩니다.
   *
   * <p>서버가 하는 일은 자료를 모아 한 시점으로 내려주는 것뿐입니다.
   */
  public JsonNode clientPlanInput(UUID clientUserId) {
    CurrentUser me = currentUserService.requireCurrentUser();
    requireProfessionalId(me);
    UUID authUserId = me.authUserId() != null ? me.authUserId() : me.id();

    String json = userScopedDb.as(authUserId, con -> {
      try (PreparedStatement ps = con.prepareStatement("SELECT public.get_client_plan_input(?)::text")) {
        ps.setObject(1, clientUserId);
        try (ResultSet rs = ps.executeQuery()) {
          return rs.next() ? rs.getString(1) : null;
        }
      }
    });

    if (json == null) {
      throw new ApiException(HttpStatus.NOT_FOUND, "초안을 만들 수 없습니다. 고객이 동의했는지 확인해주세요.");
    }
    try {
      return objectMapper.readTree(json);
    } catch (Exception e) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "초안 자료를 읽지 못했습니다.");
    }
  }

  // ───────────────────────────────────────────────────────────── 관리자

  /**
   * 전문가 계정 발급. 이미 가입된 계정의 역할을 올리고 {@code professionals} 행을 만듭니다.
   * 계정을 새로 만들지는 않습니다 — 그러면 "사람이 승인한다" 는 전제가 사라집니다.
   */
  public ProfessionalProfileResponse issueProfessional(IssueProfessionalRequest request) {
    currentUserService.requireRole(UserRole.ADMIN);

    String type = request.type() == null ? "" : request.type().trim().toUpperCase();
    if (!"PERSONAL_TRAINER".equals(type) && !"PHYSIO".equals(type)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "type 은 PERSONAL_TRAINER 또는 PHYSIO 입니다.");
    }

    UUID profileId = jdbcTemplate.query(
        "SELECT id FROM public.user_profiles WHERE lower(email) = lower(?) LIMIT 1",
        rs -> rs.next() ? UUID.fromString(rs.getString(1)) : null, request.email().trim());
    if (profileId == null) {
      throw new ApiException(HttpStatus.NOT_FOUND, "그 이메일로 가입된 계정이 없습니다. 먼저 가입하게 해주세요.");
    }

    jdbcTemplate.update("UPDATE public.user_profiles SET role = 'PROFESSIONAL', updated_at = now() WHERE id = ?",
        profileId);

    String displayName = request.displayName() == null || request.displayName().isBlank()
        ? null : request.displayName().trim();

    return jdbcTemplate.query(
        "INSERT INTO public.professionals (user_profile_id, type, display_name)"
            + " VALUES (?, ?, ?)"
            + " ON CONFLICT (user_profile_id) DO UPDATE"
            + "   SET type = EXCLUDED.type,"
            + "       display_name = coalesce(EXCLUDED.display_name, public.professionals.display_name),"
            + "       status = 'ACTIVE', updated_at = now()"
            + " RETURNING id, type, coalesce(display_name, '') AS name, status",
        rs -> {
          if (!rs.next()) throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "전문가 등록에 실패했습니다.");
          return new ProfessionalProfileResponse(UUID.fromString(rs.getString("id")),
              rs.getString("type"), rs.getString("name"), rs.getString("status"));
        },
        profileId, type, displayName);
  }

  // ───────────────────────────────────────────────────────────── 내부

  /** 활성 전문가가 아니면 403. 판단은 DB 함수 한 곳에서만 합니다. */
  private UUID requireProfessionalId(CurrentUser me) {
    UUID authUserId = me.authUserId() != null ? me.authUserId() : me.id();
    UUID proId = userScopedDb.as(authUserId, con -> {
      try (PreparedStatement ps = con.prepareStatement("SELECT public.current_professional_id()");
           ResultSet rs = ps.executeQuery()) {
        if (!rs.next()) return null;
        String value = rs.getString(1);
        return value == null ? null : UUID.fromString(value);
      }
    });
    if (proId == null) {
      throw new ApiException(HttpStatus.FORBIDDEN, "전문가 계정만 쓸 수 있습니다.");
    }
    return proId;
  }

  private String inviteUrl(String token) {
    return appUrl + "/?invite=" + token;
  }

  private static OffsetDateTime offset(Timestamp ts) {
    return ts == null ? null : ts.toInstant().atOffset(ZoneOffset.UTC);
  }
}
