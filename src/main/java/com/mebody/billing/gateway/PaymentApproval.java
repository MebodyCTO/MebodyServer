package com.mebody.billing.gateway;

/**
 * 결제사가 "이 결제는 승인됐다" 고 알려준 결과.
 *
 * @param provider  payments.provider 에 들어갈 값 (dev / toss / google_play)
 * @param txnId     결제사의 거래 식별자. payments 의 UNIQUE 키라 중복 승인을 막는 근거가 됩니다
 * @param amountKrw 결제사가 확인해준 실제 금액. <b>클라이언트가 보낸 금액이 아닙니다</b>
 * @param raw       원문 응답. 나중에 대사(reconciliation)할 때 필요합니다
 */
public record PaymentApproval(String provider, String txnId, int amountKrw, String raw) {}
