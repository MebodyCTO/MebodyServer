package com.mebody.mission.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 하루치 미션 진행. 홈페이지 「미션 진행」 카드 한 줄입니다.
 *
 * <p>예전에는 {@code user_mission_progress} 행을 그대로 옮겼습니다. 그 테이블이 비어 있어
 * 카드가 언제나 비었고, 지금은 실제 데이터인 {@code user_missions} 를 하루 단위로 묶어 씁니다.
 *
 * @param id           저니 id (예전에는 진행 행 id)
 * @param missionId    더는 쓰지 않습니다. 옛 응답 모양을 깨지 않으려고 남겨 둔 자리이고 항상 null 입니다
 * @param dayNo        14일 루틴의 몇 일차인가. 화면이 "미션 1" 대신 "DAY 3" 을 보여주게 합니다
 * @param currentCount 그날 끝낸 개수
 * @param targetCount  그날 배정된 개수
 */
public record MissionProgressDto(
    UUID id,
    UUID missionId,
    int dayNo,
    int currentCount,
    int targetCount,
    BigDecimal achievementRate,
    OffsetDateTime completedAt
) {
}
