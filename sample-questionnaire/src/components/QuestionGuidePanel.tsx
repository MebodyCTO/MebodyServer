import { useEffect, useRef } from 'react'
import { LottieCharacter } from './LottieCharacter'
import type { QuestionPhase } from '../data/sampleQuestionGuides'

interface QuestionGuidePanelProps {
  mediaKey: string
  gifSrc: string
  guideText: string
  phase: QuestionPhase
  stepKey: string | number
  /** 잘 모르겠음(②) 선택 시 상단 이미지를 유지하고 하단 GIF는 생략 */
  hideMedia?: boolean
}

export function QuestionGuidePanel({
  mediaKey,
  gifSrc,
  guideText,
  phase,
  stepKey,
  hideMedia = false,
}: QuestionGuidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (phase !== 'guide') return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      })
    })
  }, [phase, stepKey])

  return (
    <div
      ref={panelRef}
      id="question-guide-panel"
      className="animate-slide-up-in w-full space-y-4"
    >
      {hideMedia ? null : (
        <LottieCharacter mediaKey={`guide-${mediaKey}`} gifSrc={gifSrc} className="mx-auto px-0" />
      )}
      <div className="rounded-2xl bg-emerald-50/90 px-5 py-4">
        <p className="text-sm font-bold text-emerald-700">이렇게 확인해 보세요</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-700" style={{ wordBreak: 'keep-all' }}>
          {guideText}
        </p>
      </div>
    </div>
  )
}
