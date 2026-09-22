package com.mebody.account.dto;

/**
 * 탈퇴 결과.
 *
 * @param keptOrders   남는 주문 수. 전자상거래법상 보존 대상입니다.
 * @param keptPayments 남는 결제 수.
 * @param note         화면에 그대로 보여줄 안내 문장.
 */
public record AccountDeletionResponse(
    int keptOrders,
    int keptPayments,
    String note
) {
}
