package com.mebody.metrics.dto;

/**
 * 퍼널 한 칸.
 *
 * @param event  이벤트 이름
 * @param label  화면에 보여줄 이름
 * @param count  기간 안의 건수
 * @param rate   바로 앞 칸 대비 비율(%). 첫 칸은 null
 */
public record FunnelStep(String event, String label, long count, Double rate) {
}
