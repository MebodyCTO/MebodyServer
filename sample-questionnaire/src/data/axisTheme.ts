/**
 * 축 표시용 테마 — 앱(mebody-jjh/src/data/axisTheme.ts)과 **같은 값**입니다.
 *
 * 이전에는 이 파일만 틸 램프(#54B8A5 계열)로 남아 있어서, 같은 4축 시각화가
 * 홈페이지·앱에서는 브랜드 그린, /sample 에서는 틸로 나왔습니다.
 * 값을 바꿀 때는 앱 쪽과 함께 바꾸세요.
 */
const GREEN = '#014725'
const GREEN_MID = '#016B38'
const MINT = '#E8F3EC'
const MUTED = '#587761'

export const AXIS_GREEN_THEME = {
  deep: GREEN,
  primary: GREEN_MID,
  mid: '#2D8A5C',
  soft: '#A8D5C0',
  surface: MINT,
  track: '#E5EBE5',
  text: GREEN,
  textSoft: MUTED,
} as const
