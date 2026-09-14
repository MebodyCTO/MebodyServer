package com.mebody.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** 승인 대기 상태로 남은 계정을 풀어달라는 요청. 이메일 또는 휴대폰 번호. */
public record AccountApprovalRequest(@NotBlank String identifier) {
}
