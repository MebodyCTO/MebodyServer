import { useCallback, useEffect, useState } from 'react'
import {
  getSampleQuestionsSync,
  fetchSampleQuestionsFromDb,
  submitSampleResponse,
} from '../api/sampleQuestionnaire'
import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'
import {
  getQuestionGuideContent,
  isGuideStepEnabled,
  type QuestionPhase,
} from '../data/sampleQuestionGuides'
import { calculateSampleBodyCode, type AnswerMap } from '../utils/sampleBodyCodeCalculator'
import type { SampleCompletionPayload } from '../types/sampleCompletion'
import { preloadAllSampleGifs, preloadSampleGif } from '../utils/preloadSampleGifs'
import { preloadResultCharacters } from '../utils/preloadResultCharacters'
import { resolveQuestionMedia } from '../assets/questionMedia'
import { QuestionnaireShell } from './QuestionnaireShell'
import { QuestionMediaLayout } from './QuestionMediaLayout'
import { QuestionCard } from './QuestionCard'
import { QuestionNavBar } from './QuestionNavBar'

interface SampleQuestionnaireProps {
  onComplete: (result: SampleCompletionPayload) => void
}

function mergeQuestionsFromDb(
  current: SampleQuestion[],
  fromDb: SampleQuestion[],
): SampleQuestion[] {
  if (fromDb.length !== current.length) return current
  const codesMatch = fromDb.every(
    (q, i) => q.question_code === current[i]?.question_code,
  )
  return codesMatch ? fromDb : current
}

export function SampleQuestionnaire({ onComplete }: SampleQuestionnaireProps) {
  const [questions, setQuestions] = useState<SampleQuestion[]>(getSampleQuestionsSync)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<QuestionPhase>('select')
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchSampleQuestionsFromDb().then((fromDb) => {
      if (!fromDb?.length) return
      setQuestions((prev) => mergeQuestionsFromDb(prev, fromDb))
    })
  }, [])

  useEffect(() => {
    preloadAllSampleGifs(questions, questions[0]?.media_url)
  }, [questions])

  useEffect(() => {
    setPhase('select')
  }, [currentIndex])

  useEffect(() => {
    const mediaKey = questions[currentIndex]?.media_url
    if (!mediaKey) return
    preloadSampleGif(resolveQuestionMedia(mediaKey).gif)
  }, [currentIndex, questions])

  const totalQuestions = questions.length
  const currentQuestion = questions[currentIndex]
  const nextQuestion = questions[currentIndex + 1]
  const nextNextQuestion = questions[currentIndex + 2]
  const guideEnabled = currentQuestion ? isGuideStepEnabled(currentQuestion.question_number) : false
  const guideContent = currentQuestion ? getQuestionGuideContent(currentQuestion) : null
  const guideGifSrc = guideContent
    ? resolveQuestionMedia(guideContent.gifKey).gif
    : undefined
  const selectedAnswer = currentQuestion ? answers[currentQuestion.question_code] : undefined

  const completeQuestionnaire = useCallback(
    async (nextAnswers: AnswerMap) => {
      setIsSubmitting(true)
      const { code, axisChars } = calculateSampleBodyCode(nextAnswers, questions)
      preloadResultCharacters(code)
      submitSampleResponse(nextAnswers, code).catch(() => {})
      onComplete({ code, axisChars, answers: nextAnswers })
    },
    [onComplete, questions],
  )

  const handleAnswer = useCallback(
    async (value: AnswerMap[string]) => {
      if (!currentQuestion || isSubmitting) return

      const nextAnswers = { ...answers, [currentQuestion.question_code]: value }
      setAnswers(nextAnswers)

      if (guideEnabled && phase === 'guide') {
        return
      }

      if (guideEnabled && phase === 'select') {
        setPhase('guide')
        return
      }

      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex((index) => index + 1)
        return
      }

      await completeQuestionnaire(nextAnswers)
    },
    [
      answers,
      completeQuestionnaire,
      currentIndex,
      currentQuestion,
      guideEnabled,
      isSubmitting,
      phase,
      totalQuestions,
    ],
  )

  const handleGuidePrev = useCallback(() => {
    if (currentIndex <= 0) return

    const prevIndex = currentIndex - 1
    const prevQuestion = questions[prevIndex]
    const prevHasAnswer = Boolean(prevQuestion && answers[prevQuestion.question_code])

    setCurrentIndex(prevIndex)
    setPhase(prevHasAnswer ? 'guide' : 'select')
  }, [answers, currentIndex, questions])

  const handleGuideNext = useCallback(async () => {
    if (!currentQuestion || isSubmitting) return

    if (currentIndex < totalQuestions - 1) {
      setPhase('select')
      setCurrentIndex((index) => index + 1)
      return
    }

    await completeQuestionnaire(answers)
  }, [answers, completeQuestionnaire, currentIndex, currentQuestion, isSubmitting, totalQuestions])

  if (!currentQuestion) {
    return (
      <QuestionnaireShell current={1} total={12}>
        <div className="p-8 text-center text-gray-600">문항을 불러오지 못했습니다.</div>
      </QuestionnaireShell>
    )
  }

  return (
    <QuestionnaireShell current={currentIndex + 1} total={totalQuestions}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <QuestionMediaLayout
          stepKey={currentQuestion.question_code}
          phase={phase}
          guideEnabled={guideEnabled}
          guideGifSrc={guideGifSrc}
          guideText={guideContent?.guideText}
          question={currentQuestion}
          nextQuestion={nextQuestion}
          nextNextQuestion={nextNextQuestion}
        >
          <QuestionCard
            question={currentQuestion}
            phase={phase}
            selectedAnswer={selectedAnswer}
            onAnswer={handleAnswer}
          />
        </QuestionMediaLayout>

        {guideEnabled && phase === 'guide' ? (
          <QuestionNavBar
            onPrev={handleGuidePrev}
            onNext={handleGuideNext}
            isLastQuestion={currentIndex === totalQuestions - 1}
            canGoPrev={currentIndex > 0}
          />
        ) : null}
      </div>
    </QuestionnaireShell>
  )
}
