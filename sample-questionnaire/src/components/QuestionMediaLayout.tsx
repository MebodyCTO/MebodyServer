import { useEffect } from 'react'
import { LottieCharacter } from './LottieCharacter'
import { FadeSlidePanel } from './FadeSlidePanel'
import { QuestionGuidePanel } from './QuestionGuidePanel'
import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'
import type { QuestionPhase } from '../data/sampleQuestionGuides'
import type { AnswerValue } from '../utils/sampleBodyCodeCalculator'
import { getSampleQuestionMediaSet, resolveSampleAnswerMedia } from '../assets/questionMedia'

/** 잘 모르겠음(②) 선택 시 하단 가이드 GIF 대신 상단 이미지를 유지한다 */
const UNCERTAIN_ANSWER: AnswerValue = '②'

interface QuestionMediaLayoutProps {
  /** 문항 전환 시 key — 캐릭터는 유지, 하단 문항만 페이드 */
  stepKey: number | string
  phase: QuestionPhase
  guideEnabled: boolean
  guideText?: string
  selectedAnswer?: AnswerValue
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
  guideText,
  selectedAnswer,
  question,
  nextQuestion,
  nextNextQuestion,
  children,
}: QuestionMediaLayoutProps) {
  const mainMedia = getSampleQuestionMediaSet(
    question?.question_number ?? 0,
    question?.media_url,
  ).main
  const nextMainMedia = getSampleQuestionMediaSet(
    nextQuestion?.question_number ?? 0,
    nextQuestion?.media_url,
  ).main
  const nextNextMainMedia = getSampleQuestionMediaSet(
    nextNextQuestion?.question_number ?? 0,
    nextNextQuestion?.media_url,
  ).main
  const answerMedia = resolveSampleAnswerMedia(
    question?.question_number ?? 0,
    selectedAnswer,
    question?.media_url,
  )
  const isUncertainAnswer = selectedAnswer === UNCERTAIN_ANSWER
  const isGuidePhase = guideEnabled && phase === 'guide'
  const showTopMedia = !guideEnabled || phase === 'select' || (isGuidePhase && isUncertainAnswer)
  const showGuidePanel = isGuidePhase && guideText

  useEffect(() => {
    const preload = (src?: string) => {
      if (!src) return
      const img = new Image()
      img.decoding = 'async'
      img.src = src
    }
    preload(nextMainMedia)
    preload(nextNextMainMedia)
  }, [nextMainMedia, nextNextMainMedia])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          showTopMedia ? 'max-h-[360px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <LottieCharacter
          mediaKey={`question-${question?.question_number ?? stepKey}`}
          gifSrc={mainMedia}
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
                  mediaKey={`question-${question?.question_number ?? stepKey}-${selectedAnswer ?? 'none'}`}
                  gifSrc={answerMedia ?? mainMedia}
                  guideText={guideText}
                  phase={phase}
                  stepKey={stepKey}
                  hideMedia={isUncertainAnswer}
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
