package com.mebody.auth.dto;

/**
 * 자동 승인 결과.
 *
 * <p><b>계정이 있었는지 알려주지 않습니다.</b> 예전에는 {@code found}·{@code alreadyApproved} 를
 * 돌려줬는데, 그러면 이 공개 엔드포인트에 이메일이나 번호를 하나씩 넣어 보는 것만으로
 * "그 사람이 우리 회원인가" 를 알아낼 수 있었습니다. 비밀번호 재설정({@code /reset})은 같은 이유로
 * 처음부터 항상 같은 응답을 주도록 만들어 두었는데, 승인만 빠져 있었습니다.
 *
 * <p>그래서 계정이 있든 없든, 이미 승인돼 있었든 이번에 풀었든 응답이 같습니다.
 * 호출부에 필요한 정보는 "다시 로그인을 시도해도 되는가" 하나뿐이고, 계정이 없으면
 * 그 다음 로그인이 알아서 실패합니다.
 *
 * @param approved   다시 로그인을 시도해도 되는가. 계정 존재 여부와 무관합니다
 * @param loginEmail 로그인에 쓸 값(휴대폰이면 별칭 이메일). 보낸 값에서 계산한 것이라 새 정보가 아닙니다
 */
public record AccountApprovalResponse(
    boolean approved,
    String loginEmail
) {
}
