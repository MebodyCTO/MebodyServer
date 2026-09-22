package com.mebody.professional.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 미션 배정 요청.
 *
 * <p>{@code contentKey} 는 라이브러리에 있는 값이어야 합니다. 동작 설명을 직접 보내는
 * 자리가 없는 것이 요점입니다 — 검증되지 않은 지시를 남의 몸에 나르지 않기 위해서입니다.
 */
public record AssignMissionRequest(
    @NotBlank String contentKey,
    @Size(max = 200, message = "메모는 200자까지입니다.") String note
) {
}
