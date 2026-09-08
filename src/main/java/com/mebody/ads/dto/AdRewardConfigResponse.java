package com.mebody.ads.dto;

/**
 * 앱이 보너스를 스스로 청구할지, 서버 지급을 기다릴지 정하는 데 씁니다.
 * ssvEnabled=true 면 서버가 AdMob 콜백을 검증해 지급하므로 앱은 기다리기만 합니다.
 */
public record AdRewardConfigResponse(boolean ssvEnabled) {}
