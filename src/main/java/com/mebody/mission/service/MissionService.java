package com.mebody.mission.service;

import com.mebody.common.security.CurrentUser;
import com.mebody.common.security.CurrentUserService;
import com.mebody.mission.dto.MissionProgressDto;
import com.mebody.mission.dto.MissionSummaryResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 홈페이지 「미션 진행」 카드가 쓰는 요약.
 *
 * <h2>왜 다시 썼는가</h2>
 * 예전에는 {@code user_mission_progress} 와 {@code missions} 를 읽었습니다. 그 두 테이블은
 * 저니 도메인({@code user_journeys} · {@code user_missions})이 대체하면서 <b>0행으로 남았고</b>,
 * 그래서 이 카드는 로그인해도 언제나 "0% · 미션 없음" 만 보여 줬습니다. 고장이 아니라
 * 빈 테이블을 정직하게 그린 것인데, 쓰는 사람에게는 고장으로 보입니다.
 *
 * <p>이제 앱이 실제로 쓰는 {@code user_missions} 를 읽습니다. 홈페이지와 앱이 같은 숫자를
 * 보게 되고, 옛 테이블 두 개는 아무도 쓰지 않게 되어 정리할 수 있습니다(062).
 *
 * <h2>왜 JPA 가 아니라 JdbcTemplate 인가</h2>
 * {@code user_missions} 는 앱(PostgREST)이 주인인 테이블입니다. 엔티티를 하나 더 만들면
 * 스키마가 바뀔 때마다 두 곳을 맞춰야 합니다. 읽기 한 번뿐이라 쿼리로 둡니다.
 */
@Service
public class MissionService {
  private final CurrentUserService currentUserService;
  private final JdbcTemplate jdbcTemplate;

  public MissionService(CurrentUserService currentUserService, JdbcTemplate jdbcTemplate) {
    this.currentUserService = currentUserService;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Transactional(readOnly = true)
  public MissionSummaryResponse myMissions() {
    CurrentUser user = currentUserService.requireCurrentUser();

    // 하루 단위로 묶습니다. 카드가 보여줄 것은 "며칠에 몇 개를 했는가" 입니다.
    List<MissionProgressDto> items = jdbcTemplate.query(
        "SELECT m.user_journey_id, m.day_no,"
            + "       count(*)                                        AS planned,"
            + "       count(*) FILTER (WHERE m.status = 'completed')   AS done,"
            + "       max(m.completed_at)                              AS last_at"
            + "  FROM public.user_missions m"
            + " WHERE m.user_id = ?"
            + " GROUP BY m.user_journey_id, m.day_no"
            + " ORDER BY m.day_no DESC"
            + " LIMIT 14",
        (ResultSet rs, int rowNum) -> {
          int planned = rs.getInt("planned");
          int done = rs.getInt("done");
          BigDecimal rate = planned == 0 ? BigDecimal.ZERO
              : BigDecimal.valueOf(done).multiply(BigDecimal.valueOf(100))
                  .divide(BigDecimal.valueOf(planned), 2, RoundingMode.HALF_UP);
          return new MissionProgressDto(
              UUID.fromString(rs.getString("user_journey_id")),
              null,
              rs.getInt("day_no"),
              done,
              planned,
              rate,
              // 그날을 다 끝냈을 때만 완료 시각을 채웁니다. max(completed_at) 을 그대로 쓰면
              // 3개 중 1개만 해도 "완료" 로 보입니다.
              (done > 0 && done >= planned && rs.getTimestamp("last_at") != null)
                  ? rs.getTimestamp("last_at").toInstant().atOffset(java.time.ZoneOffset.UTC)
                  : null);
        },
        user.id());

    if (items.isEmpty()) {
      return new MissionSummaryResponse(BigDecimal.ZERO, 0, 0, new ArrayList<>());
    }

    long completed = items.stream().filter(i -> i.currentCount() >= i.targetCount() && i.targetCount() > 0).count();
    long active = items.size() - completed;

    int totalPlanned = items.stream().mapToInt(MissionProgressDto::targetCount).sum();
    int totalDone = items.stream().mapToInt(MissionProgressDto::currentCount).sum();
    BigDecimal average = totalPlanned == 0 ? BigDecimal.ZERO
        : BigDecimal.valueOf(totalDone).multiply(BigDecimal.valueOf(100))
            .divide(BigDecimal.valueOf(totalPlanned), 2, RoundingMode.HALF_UP);

    return new MissionSummaryResponse(average, active, completed, items);
  }
}
