package com.mebody.professional.dto;

/** 전문가가 고를 수 있는 동작. 라이브러리에 있는 것이 전부입니다. */
public record AssignableContent(
    String contentKey,
    String displayName,
    String targetMuscle,
    String releaseTitle,
    String stretchTitle,
    String caution
) {
}
