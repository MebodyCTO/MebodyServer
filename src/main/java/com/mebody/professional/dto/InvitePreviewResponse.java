package com.mebody.professional.dto;

import java.time.OffsetDateTime;

/**
 * 로그인 전에 보여줄 초대 미리보기.
 *
 * <p>누가 불렀는지 모르는 링크에 로그인하라고 할 수는 없어서 전문가 이름만 알려줍니다.
 * 토큰은 추측할 수 없으므로 "토큰을 아는 사람" 에게만 이 이름이 보입니다.
 * 고객이 누구인지, 결과가 있는지는 여기서 절대 알려주지 않습니다.
 */
public record InvitePreviewResponse(
    boolean valid,
    String reason,
    String professionalName,
    String professionalType,
    OffsetDateTime expiresAt
) {
  public static InvitePreviewResponse invalid(String reason) {
    return new InvitePreviewResponse(false, reason, null, null, null);
  }
}
