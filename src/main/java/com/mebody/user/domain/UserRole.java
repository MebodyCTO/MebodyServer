package com.mebody.user.domain;

/**
 * 계정의 역할.
 *
 * <p>DB 의 {@code user_profiles.role} CHECK 와 **반드시 같은 값**이어야 합니다
 * (`db/journey/052_professional_core.sql`). 한쪽에만 값을 더하면, 그 역할을 가진 행을
 * 읽는 순간 JPA 가 enum 변환에 실패해 500 이 납니다. 실제로 052 가 DB 에 PROFESSIONAL 을
 * 더했는데 여기에는 없어서, 전문가 계정은 로그인만 해도 터지는 상태였습니다.
 */
public enum UserRole {
  MEMBER,
  SELLER,
  ADMIN,
  /** 트레이너·물리치료사. 동의한 고객의 결과만 볼 수 있습니다. 승인은 사람이 합니다. */
  PROFESSIONAL
}
