/**
 * mebody 브랜드 마크 — 길이가 다른 라운드 바 4개 (목 · 어깨 · 골반 · 하체).
 *
 * 좌표는 mebody-jjh/scripts/make-icons.py 의 `mark_rects()` 가 정본이고,
 * 앱(mebody-jjh/src/components/ui/BrandMark.tsx)·파비콘·앱 아이콘과 같은 값입니다.
 * 형태를 바꿀 때는 그 스크립트를 고치고 세 곳을 함께 갱신하세요.
 */

const W = 304
const H = 308

export function BrandMark({
  size = 16,
  color = 'currentColor',
  title,
}: {
  size?: number
  color?: string
  title?: string
}) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      height={size}
      width={(size * W) / H}
      fill={color}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect x="108" y="0" width="88" height="62" rx="31" />
      <rect x="0" y="82" width="304" height="62" rx="31" />
      <rect x="52" y="164" width="200" height="62" rx="31" />
      <rect x="86" y="246" width="132" height="62" rx="31" />
    </svg>
  )
}
