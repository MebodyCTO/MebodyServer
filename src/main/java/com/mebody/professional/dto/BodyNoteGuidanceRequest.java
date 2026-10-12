package com.mebody.professional.dto;

import java.util.UUID;

/**
 * 전문가가 고객의 몸 기록을 보고 남기는 안내.
 *
 * <p>{@code bodyNoteId} 는 선택입니다 — 특정 기록을 보고 쓴 것이면 담고, 전반적인 말이면 비웁니다.
 * 남의 고객 기록 id 를 끼워 넣어도 DB 함수가 걸러냅니다(074).
 *
 * <p>{@code guidanceType} 허용값: comment · check_next_session · lifestyle_suggestion · linked_mission
 */
public record BodyNoteGuidanceRequest(UUID bodyNoteId, String guidanceType, String message) {}
