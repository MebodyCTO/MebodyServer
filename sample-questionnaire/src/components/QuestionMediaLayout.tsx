import { useEffect } from 'react'
import { LottieCharacter } from './LottieCharacter'
import { FadeSlidePanel } from './FadeSlidePanel'
import { QuestionGuidePanel } from './QuestionGuidePanel'
import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'
import type { QuestionPhase } from '../data/sampleQuestionGuides'
import { resolveQuestionMedia } from '../assets/questionMedia'

interface QuestionMediaLayoutProps {
  /** 문항 전환 시 key — 캐릭터는 유지, 하단 문항만 페이드 */
  stepKey: number | string
  phase: QuestionPhase
  guideEnabled: boolean
  guideGifSrc?: string
  guideText?: string
  question?: SampleQuestion
  nextQuestion?: SampleQuestion
  nextNextQuestion?: SampleQuestion
  children: React.ReactNode
}

/**
 * 상단 캐릭터(선택 단계) + 하단 문항 + 가이드 단계 하단 미디어
 */
export function QuestionMediaLayout({
  stepKey,
  phase,
  guideEnabled,
  guideGifSrc,
  guideText,
  question,
  nextQuestion,
  nextNextQuestion,
  children,
}: QuestionMediaLayoutProps) {
  const { gif } = resolveQuestionMedia(question?.media_url)
  const { gif: nextGif } = resolveQuestionMedia(nextQuestion?.media_url)
  const { gif: nextNextGif } = resolveQuestionMedia(nextNextQuestion?.media_url)
  const showTopMedia = !guideEnabled || phase === 'select'
  const showGuidePanel = guideEnabled && phase === 'guide' && guideGifSrc && guideText
  const isGuidePhase = guideEnabled && phase === 'guide'

  useEffect(() => {
    const preload = (src?: string) => {
      if (!src) return
      const img = new Image()
      img.decoding = 'async'
      img.src = src
    }
    preload(nextGif)
    preload(nextNextGif)
  }, [nextGif, nextNextGif])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          showTopMedia ? 'max-h-[360px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <LottieCharacter
          mediaKey={String(question?.media_url ?? stepKey)}
          gifSrc={gif}
          className="px-4 pt-2"
        />
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-3 ${
          isGuidePhase ? 'justify-start' : 'justify-end'
        }`}
      >
        <FadeSlidePanel key={stepKey}>
          {isGuidePhase ? (
            <div className="flex flex-col gap-5 py-2">
              {children}
              {showGuidePanel ? (
                <QuestionGuidePanel
                  mediaKey={String(question?.media_url ?? stepKey)}
                  gifSrc={guideGifSrc}
                  guideText={guideText}
                  phase={phase}
                  stepKey={stepKey}
                />
              ) : null}
            </div>
          ) : (
            children
          )}
        </FadeSlidePanel>
      </div>
    </div>
  )
}
