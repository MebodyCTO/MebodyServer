package com.mebody.professional.dto;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * 고객의 수행 기록. {@code get_client_journey_summary()} 가 만든 jsonb 를 그대로 옮깁니다.
 *
 * <p>여기서 모양을 다시 정의하지 않는 이유: 화면이 쓰는 값(진행률·일자별·피드백)은 한 시점의
 * 한 덩어리입니다. Java 레코드로 쪼개 담으면 DB 함수를 고칠 때마다 이쪽도 같이 고쳐야 하고,
 * 한쪽만 고치면 조용히 값이 빠집니다.
 *
 * @param hasJourney 관계는 맞는데 아직 루틴을 시작하지 않은 고객이면 false.
 *                   <b>권한 없음과 다릅니다</b> — 권한이 없으면 애초에 404 입니다.
 * @param summary    함수가 돌려준 내용 그대로. hasJourney 가 false 면 비어 있습니다.
 */
public record ClientJourneyResponse(
    boolean hasJourney,
    JsonNode summary
) {
}
