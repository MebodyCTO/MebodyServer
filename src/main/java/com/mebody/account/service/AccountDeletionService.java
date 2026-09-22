package com.mebody.account.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mebody.account.dto.AccountDeletionResponse;
import com.mebody.common.exception.ApiException;
import com.mebody.common.security.CurrentUser;
import com.mebody.common.security.CurrentUserService;
import com.mebody.common.security.SupabaseProperties;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 계정 탈퇴.
 *
 * <p>두 걸음입니다. 순서가 중요합니다.
 * <ol>
 *   <li>{@code prepare_account_deletion()} — 막아야 할 것(상품을 남긴 판매자)을 막고,
 *       CASCADE 가 닿지 않는 것을 지우고, 남을 거래 기록 수를 돌려줍니다.</li>
 *   <li>서비스 롤로 {@code auth.users} 삭제 — 나머지는 외래키 CASCADE 가 지웁니다.</li>
 * </ol>
 *
 * <p>인증 계정 삭제를 마지막에 두는 이유는, 중간에 실패해도 계정이 그대로 남아
 * 사용자가 다시 시도할 수 있게 하기 위해서입니다. 반대로 하면 계정만 사라지고
 * 데이터가 떠도는 상태가 생깁니다.
 *
 * <p>왜 서버가 하는가: {@code auth.users} 삭제는 서비스 롤 키가 필요하고 그 키는 앱에 둘 수 없습니다.
 */
@Service
public class AccountDeletionService {
  private final CurrentUserService currentUserService;
  private final SupabaseProperties supabaseProperties;
  private final JdbcTemplate jdbcTemplate;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient = HttpClient.newHttpClient();

  public AccountDeletionService(CurrentUserService currentUserService,
                                SupabaseProperties supabaseProperties,
                                JdbcTemplate jdbcTemplate,
                                ObjectMapper objectMapper) {
    this.currentUserService = currentUserService;
    this.supabaseProperties = supabaseProperties;
    this.jdbcTemplate = jdbcTemplate;
    this.objectMapper = objectMapper;
  }

  public AccountDeletionResponse deleteMyAccount() {
    CurrentUser user = currentUserService.requireCurrentUser();
    UUID authUserId = user.authUserId() != null ? user.authUserId() : user.id();
    if (authUserId == null) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "로그인 정보를 확인할 수 없습니다.");
    }

    JsonNode report = prepare(authUserId);
    deleteAuthUser(authUserId);

    JsonNode kept = report.path("kept");
    return new AccountDeletionResponse(
        kept.path("orders").asInt(0),
        kept.path("payments").asInt(0),
        report.path("note").asText("탈퇴가 완료되었습니다."));
  }

  /**
   * 앱 데이터 정리. 함수가 auth.uid() 로 본인을 판별하므로, 검증된 토큰의 subject 를
   * 같은 트랜잭션에 심어 줍니다. 남의 계정을 지정할 방법이 없습니다.
   *
   * <p>set_config 의 세 번째 인자가 true 라 그 값은 **트랜잭션 안에서만** 삽니다.
   * 그래서 두 문장을 한 연결·한 트랜잭션에서 직접 처리합니다. 커넥션 풀에서 문장마다
   * 다른 연결을 받으면 심어둔 값이 사라져 함수가 "로그인이 필요합니다" 로 실패합니다.
   */
  protected JsonNode prepare(UUID authUserId) {
    try {
      String claims = objectMapper.writeValueAsString(
          Map.of("sub", authUserId.toString(), "role", "authenticated"));

      String json = jdbcTemplate.execute((Connection con) -> {
        boolean previousAutoCommit = con.getAutoCommit();
        con.setAutoCommit(false);
        try {
          try (PreparedStatement setClaims =
                   con.prepareStatement("SELECT set_config('request.jwt.claims', ?, true)")) {
            setClaims.setString(1, claims);
            setClaims.execute();
          }
          String result;
          try (PreparedStatement call =
                   con.prepareStatement("SELECT public.prepare_account_deletion()::text");
               ResultSet rs = call.executeQuery()) {
            result = rs.next() ? rs.getString(1) : null;
          }
          con.commit();
          return result;
        } catch (SQLException e) {
          con.rollback();
          throw e;
        } finally {
          con.setAutoCommit(previousAutoCommit);
        }
      });

      return objectMapper.readTree(json == null ? "{}" : json);
    } catch (org.springframework.dao.DataAccessException e) {
      String message = String.valueOf(e.getMostSpecificCause().getMessage());
      if (message.contains("등록한 상품이")) {
        throw new ApiException(HttpStatus.CONFLICT, message);
      }
      if (message.contains("does not exist")) {
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
            "탈퇴에 필요한 DB 변경이 아직 적용되지 않았습니다. db/journey/046_delete_account.sql 을 실행해주세요.");
      }
      throw new ApiException(HttpStatus.BAD_GATEWAY, "탈퇴 처리 중 오류가 발생했습니다: " + message);
    } catch (IOException e) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, "탈퇴 결과를 읽지 못했습니다.");
    }
  }

  private void deleteAuthUser(UUID authUserId) {
    String serviceRoleKey = supabaseProperties.serviceRoleKey();
    if (serviceRoleKey == null || serviceRoleKey.isBlank()) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다.");
    }

    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(projectUrl() + "/auth/v1/admin/users/" + authUserId))
          .DELETE()
          .header("Authorization", "Bearer " + serviceRoleKey)
          .header("apikey", serviceRoleKey)
          .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      // 404 는 이미 지워진 것이므로 성공으로 봅니다(같은 요청을 두 번 보내도 괜찮게).
      if (response.statusCode() < 300 || response.statusCode() == 404) return;

      throw new ApiException(HttpStatus.BAD_GATEWAY,
          "계정 삭제에 실패했습니다(" + response.statusCode() + "). 잠시 후 다시 시도해주세요.");
    } catch (ApiException e) {
      throw e;
    } catch (IOException e) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Supabase Auth 요청을 처리하지 못했습니다.");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Supabase Auth 요청이 중단되었습니다.");
    }
  }

  private String projectUrl() {
    String url = supabaseProperties.url();
    if (url != null && !url.isBlank()) return url.replaceAll("/+$", "");
    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SUPABASE_URL 설정이 필요합니다.");
  }
}
