package com.mebody.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * "지금 로그인한 사람" 으로 SQL 을 실행합니다.
 *
 * <p>DB 쪽 권한 판단은 전부 {@code auth.uid()} 를 봅니다. 그 값은 PostgREST 가 심어 주는
 * {@code request.jwt.claims} 설정에서 나오는데, 우리 서버는 PostgREST 를 거치지 않으므로
 * 그대로 부르면 언제나 NULL 입니다. 그래서 검증이 끝난 토큰의 subject 를 직접 심어 줍니다.
 *
 * <p><b>왜 연결을 직접 잡는가.</b> {@code set_config(..., true)} 의 세 번째 인자가 true 라
 * 심어둔 값이 <b>그 트랜잭션 안에서만</b> 삽니다. 커넥션 풀에서 문장마다 다른 연결을 받으면
 * 값이 사라져 함수가 "로그인이 필요합니다" 로 실패합니다. 그래서 한 연결·한 트랜잭션에서
 * 심기와 호출을 묶습니다.
 *
 * <p><b>왜 Java 에서 다시 검사하지 않는가.</b> 권한 판단을 두 군데 두면 언젠가 갈라집니다.
 * "누가 이 고객을 볼 수 있는가" 의 정의는 {@code get_client_response()} 안에 한 벌만 둡니다.
 *
 * <p>심는 값은 우리가 서명을 검증한 토큰의 subject 입니다. 호출부가 남의 id 를 넣을 수 있는
 * 자리가 아닙니다 — 넣으면 그 사람 권한으로 도니까, 이 클래스를 쓰는 쪽은 반드시
 * {@link CurrentUserService} 가 돌려준 값을 그대로 넘겨야 합니다.
 */
@Component
public class UserScopedDb {
  private final JdbcTemplate jdbcTemplate;
  private final ObjectMapper objectMapper;

  public UserScopedDb(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
    this.jdbcTemplate = jdbcTemplate;
    this.objectMapper = objectMapper;
  }

  @FunctionalInterface
  public interface Work<T> {
    T run(Connection connection) throws SQLException;
  }

  /** authUserId 를 auth.uid() 로 삼아 work 를 한 트랜잭션에서 실행합니다. */
  public <T> T as(UUID authUserId, Work<T> work) {
    final String claims;
    try {
      claims = objectMapper.writeValueAsString(
          Map.of("sub", authUserId.toString(), "role", "authenticated"));
    } catch (Exception e) {
      throw new IllegalStateException("JWT claims 를 만들지 못했습니다.", e);
    }

    return jdbcTemplate.execute((Connection con) -> {
      boolean previousAutoCommit = con.getAutoCommit();
      con.setAutoCommit(false);
      try {
        try (PreparedStatement set =
                 con.prepareStatement("SELECT set_config('request.jwt.claims', ?, true)")) {
          set.setString(1, claims);
          set.execute();
        }
        T result = work.run(con);
        con.commit();
        return result;
      } catch (SQLException e) {
        con.rollback();
        throw e;
      } finally {
        con.setAutoCommit(previousAutoCommit);
      }
    });
  }
}
