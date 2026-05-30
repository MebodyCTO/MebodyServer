import type { ReactNode } from 'react'

interface FadeSlidePanelProps {
  children: ReactNode
  className?: string
}

/** 문항·완료 화면 공통 진입 애니메이션 */
export function FadeSlidePanel({ children, className = '' }: FadeSlidePanelProps) {
  return <div className={`animate-fade-slide-in ${className}`.trim()}>{children}</div>
}
