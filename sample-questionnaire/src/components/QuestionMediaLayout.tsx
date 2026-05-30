import { LottieCharacter } from './LottieCharacter'
import { FadeSlidePanel } from './FadeSlidePanel'
import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'

interface QuestionMediaLayoutProps {
  /** 문항 전환 시 key — 캐릭터는 유지, 하단 문항만 페이드 */
  stepKey: number | string
  question?: SampleQuestion
  children: React.ReactNode
}

/**
 * 상단 캐릭터(세션당 1회 마운트·로드 상태 유지) + 하단 문항(매 문항 동일 페이드)
 */
export function QuestionMediaLayout({ stepKey, question, children }: QuestionMediaLayoutProps) {
  // DB URL은 http(s)일 때만 — 그 외는 번들 미디어(즉시·동일 UX)
  const lottieSrc =
    question?.media_type === 'lottie' && question.media_url?.startsWith('http')
      ? question.media_url
      : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LottieCharacter lottieSrc={lottieSrc} className="px-4 pt-2" />

      <div className="flex min-h-0 flex-1 flex-col justify-end px-6 pb-6 pt-3">
        <FadeSlidePanel key={stepKey}>{children}</FadeSlidePanel>
      </div>
    </div>
  )
}
