package com.mebody.professional.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 고객 결과 1건. {@code get_client_response()} 가 돌려준 것을 그대로 옮깁니다.
 *
 * <p>답변 원문(answers)은 넣지 않습니다. 상담에 필요한 것은 코드와 축 요약이고,
 * 문항별 답을 넘기면 돌려받을 수 없는 정보가 한 번에 나갑니다.
 */
public record ClientResultResponse(
    UUID clientUserId,
    String displayName,
    String calculatedCode,
    String primaryIdentity,
    JsonNode scoringMeta,
    OffsetDateTime completedAt
) {
}
