package com.mebody.metrics.dto;

import java.util.List;

/**
 * 운영자가 보는 지표 한 판.
 *
 * <p>세 퍼널을 같은 기간으로 잘라서 보여줍니다. 기간이 다르면 비교가 안 됩니다.
 *
 * @param days              며칠치인가
 * @param diagnosis         진단 퍼널 — 랜딩에서 결과까지
 * @param journey           저니 퍼널 — 결과에서 실제 수행까지
 * @param revenue           수익 퍼널 — 멤버십 화면에서 구독까지
 * @param professional      전문가 퍼널 — 초대에서 결과 열람까지
 * @param weeklyActivePros  최근 7일에 고객 화면을 연 전문가 수
 * @param totalPros         활성 전문가 수
 */
public record MetricsResponse(
    int days,
    List<FunnelStep> diagnosis,
    List<FunnelStep> journey,
    List<FunnelStep> revenue,
    List<FunnelStep> professional,
    long weeklyActivePros,
    long totalPros
) {
}
