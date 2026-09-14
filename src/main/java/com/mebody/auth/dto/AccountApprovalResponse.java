package com.mebody.auth.dto;

/**
 * 자동 승인 결과.
 *
 * @param found           그런 계정이 있었는가
 * @param approved        이번 호출로 승인 처리했는가
 * @param alreadyApproved 이미 승인돼 있었는가
 * @param loginEmail      로그인에 쓸 값(휴대폰이면 별칭 이메일)
 */
public record AccountApprovalResponse(
    boolean found,
    boolean approved,
    boolean alreadyApproved,
    String loginEmail
) {
}
