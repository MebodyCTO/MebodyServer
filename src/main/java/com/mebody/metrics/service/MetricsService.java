package com.mebody.metrics.service;

import com.mebody.common.security.CurrentUserService;
import com.mebody.metrics.dto.FunnelStep;
import com.mebody.metrics.dto.MetricsResponse;
import com.mebody.user.domain.UserRole;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 운영자가 보는 퍼널 지표.
 *
 * <h2>왜 필요한가</h2>
 * 이벤트를 쌓아도 볼 곳이 없으면 쌓는 의미가 없습니다. 로드맵의 각 Phase 에는
 * "이 비율이 얼마 미만이면 멈춘다" 는 실패 조건이 있는데, 그 숫자를 볼 화면이 없었습니다.
 *
 * <h2>어디서 읽는가</h2>
 * 두 곳입니다. 섞지 않습니다.
 * <ul>
 *   <li>{@code analytics_events} — 앱에서 쏘는 익명 이벤트. 개인 식별 값이 없습니다(054).</li>
 *   <li>{@code professional_activity_log} — 전문가별 활동. "주간 활성 전문가" 는
 *       전문가를 구분해야 세므로 이쪽입니다(056·068).</li>
 * </ul>
 *
 * <h2>비율의 뜻</h2>
 * 각 칸의 비율은 <b>바로 앞 칸 대비</b>입니다. 첫 칸 대비가 아닙니다 —
 * 어디서 떨어지는지 보려면 이웃과 비교해야 합니다.
 */
@Service
public class MetricsService {
  private final CurrentUserService currentUserService;
  private final JdbcTemplate jdbcTemplate;

  public MetricsService(CurrentUserService currentUserService, JdbcTemplate jdbcTemplate) {
    this.currentUserService = currentUserService;
    this.jdbcTemplate = jdbcTemplate;
  }

  private record Step(String event, String label) {}

  private static final List<Step> DIAGNOSIS = List.of(
      new Step("landing_viewed", "랜딩 진입"),
      new Step("questionnaire_started", "문항 시작"),
      new Step("questionnaire_completed", "문항 완료"),
      new Step("result_viewed", "결과 확인"));

  private static final List<Step> JOURNEY = List.of(
      new Step("result_viewed", "결과 확인"),
      new Step("journey_started", "루틴 시작"),
      new Step("journey_viewed", "오늘 화면"),
      new Step("mission_started", "미션 시작"),
      new Step("mission_completed", "미션 완료"),
      new Step("feedback_submitted", "피드백 남김"),
      new Step("weekly_report_viewed", "주간 리포트"),
      new Step("next_journey_viewed", "다음 루틴 화면"));

  private static final List<Step> REVENUE = List.of(
      new Step("paywall_viewed", "멤버십 화면"),
      new Step("checkout_clicked", "결제 누름"),
      new Step("subscription_started", "구독 시작"));

  public MetricsResponse funnels(int days) {
    currentUserService.requireRole(UserRole.ADMIN);
    int window = Math.min(Math.max(days, 1), 180);

    Map<String, Long> app = countAppEvents(window);
    Map<String, Long> pro = countProEvents(window);

    return new MetricsResponse(
        window,
        build(DIAGNOSIS, app),
        build(JOURNEY, app),
        build(REVENUE, app),
        professionalFunnel(app, pro),
        weeklyActivePros(),
        totalPros());
  }

  private Map<String, Long> countAppEvents(int days) {
    Map<String, Long> out = new HashMap<>();
    jdbcTemplate.query(
        "SELECT event, count(*) AS n FROM public.analytics_events"
            + " WHERE created_at > now() - make_interval(days => ?) GROUP BY event",
        rs -> { out.put(rs.getString("event"), rs.getLong("n")); },
        days);
    return out;
  }

  private Map<String, Long> countProEvents(int days) {
    Map<String, Long> out = new HashMap<>();
    try {
      jdbcTemplate.query(
          "SELECT event, count(*) AS n FROM public.professional_activity_log"
              + " WHERE created_at > now() - make_interval(days => ?) GROUP BY event",
          rs -> { out.put(rs.getString("event"), rs.getLong("n")); },
          days);
    } catch (org.springframework.dao.DataAccessException e) {
      // 056 미적용이면 표가 없습니다. 나머지 퍼널은 그대로 보여줘야 합니다.
      System.err.println("[metrics] 전문가 활동 로그를 읽지 못했습니다: " + e.getMostSpecificCause().getMessage());
    }
    return out;
  }

  /**
   * 전문가 퍼널은 두 테이블에 걸쳐 있습니다. 초대 발송과 결과 열람은 전문가별 로그에,
   * 링크 열기와 동의는 앱 이벤트에 있습니다.
   */
  private List<FunnelStep> professionalFunnel(Map<String, Long> app, Map<String, Long> pro) {
    List<FunnelStep> out = new ArrayList<>();
    long sent = pro.getOrDefault("invite_sent", 0L);
    long opened = app.getOrDefault("invite_opened", 0L);
    long accepted = app.getOrDefault("invite_accepted", 0L);
    long viewed = pro.getOrDefault("client_opened", 0L);
    long activity = pro.getOrDefault("activity_viewed", 0L);
    long assigned = pro.getOrDefault("assignment_created", 0L);

    out.add(new FunnelStep("invite_sent", "초대 발송", sent, null));
    out.add(new FunnelStep("invite_opened", "링크 열림", opened, rate(opened, sent)));
    out.add(new FunnelStep("invite_accepted", "고객 동의", accepted, rate(accepted, opened)));
    out.add(new FunnelStep("professional_result_viewed", "결과 열람", viewed, rate(viewed, accepted)));
    out.add(new FunnelStep("professional_activity_viewed", "수행 기록 열람", activity, rate(activity, viewed)));
    out.add(new FunnelStep("professional_assignment_created", "미션 배정", assigned, rate(assigned, activity)));
    return out;
  }

  private List<FunnelStep> build(List<Step> steps, Map<String, Long> counts) {
    List<FunnelStep> out = new ArrayList<>();
    Long previous = null;
    for (Step s : steps) {
      long n = counts.getOrDefault(s.event(), 0L);
      out.add(new FunnelStep(s.event(), s.label(), n, previous == null ? null : rate(n, previous)));
      previous = n;
    }
    return out;
  }

  /** 앞 칸이 0이면 비율이 없습니다. 0으로 나눈 값을 0%로 적으면 "아무도 안 넘어갔다" 로 읽힙니다. */
  private Double rate(long value, long base) {
    if (base <= 0) return null;
    return Math.round(value * 1000.0 / base) / 10.0;
  }

  /**
   * 최근 7일에 고객 화면을 한 번이라도 연 전문가 수. Phase 2 의 주지표입니다.
   * 4주간 40% 미만이면 Phase 3 을 보류한다고 로드맵에 적혀 있습니다.
   */
  private long weeklyActivePros() {
    try {
      Long n = jdbcTemplate.queryForObject(
          "SELECT count(DISTINCT professional_id) FROM public.professional_activity_log"
              + " WHERE created_at > now() - interval '7 days'"
              + "   AND event IN ('client_opened', 'activity_viewed')", Long.class);
      return n == null ? 0 : n;
    } catch (org.springframework.dao.DataAccessException e) {
      return 0;
    }
  }

  private long totalPros() {
    try {
      Long n = jdbcTemplate.queryForObject(
          "SELECT count(*) FROM public.professionals WHERE status = 'ACTIVE'", Long.class);
      return n == null ? 0 : n;
    } catch (org.springframework.dao.DataAccessException e) {
      return 0;
    }
  }
}
