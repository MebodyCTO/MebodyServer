import { useEffect } from 'react'
import { LottieCharacter } from './LottieCharacter'
import { FadeSlidePanel } from './FadeSlidePanel'
import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'
import { resolveQuestionMedia } from '../assets/questionMedia'

interface QuestionMediaLayoutProps {
  /** 문항 전환 시 key — 캐릭터는 유지, 하단 문항만 페이드 */
  stepKey: number | string
  question?: SampleQuestion
  nextQuestion?: SampleQuestion
  nextNextQuestion?: SampleQuestion
  children: React.ReactNode
}

/**
 * 상단 캐릭터(세션당 1회 마운트·로드 상태 유지) + 하단 문항(매 문항 동일 페이드)
 */
export function QuestionMediaLayout({
  stepKey,
  question,
  nextQuestion,
  nextNextQuestion,
  children,
}: QuestionMediaLayoutProps) {
  const { gif } = resolveQuestionMedia(question?.media_url)
  const { gif: nextGif } = resolveQuestionMedia(nextQuestion?.media_url)
  const { gif: nextNextGif } = resolveQuestionMedia(nextNextQuestion?.media_url)

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
      <LottieCharacter
        mediaKey={String(question?.media_url ?? stepKey)}
        gifSrc={gif}
        className="px-4 pt-2"
      />

      <div className="flex min-h-0 flex-1 flex-col justify-end px-6 pb-6 pt-3">
        <FadeSlidePanel key={stepKey}>{children}</FadeSlidePanel>
      </div>
    </div>
  )
}
