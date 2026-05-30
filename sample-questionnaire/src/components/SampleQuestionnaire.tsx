import { useCallback, useEffect, useState } from 'react'
import {
  getSampleQuestionsSync,
  fetchSampleQuestionsFromDb,
  submitSampleResponse,
} from '../api/sampleQuestionnaire'
import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'
import { calculateSampleBodyCode, type AnswerMap } from '../utils/sampleBodyCodeCalculator'
import { QuestionnaireShell } from './QuestionnaireShell'
import { QuestionMediaLayout } from './QuestionMediaLayout'
import { QuestionCard } from './QuestionCard'

interface SampleQuestionnaireProps {
  onComplete: (calculatedCode: string) => void
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
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchSampleQuestionsFromDb().then((fromDb) => {
      if (!fromDb?.length) return
      setQuestions((prev) => mergeQuestionsFromDb(prev, fromDb))
    })
  }, [])

  const totalQuestions = questions.length
  const currentQuestion = questions[currentIndex]

  const handleAnswer = useCallback(
    async (value: AnswerMap[string]) => {
      if (!currentQuestion || isSubmitting) return

      const nextAnswers = { ...answers, [currentQuestion.question_code]: value }
      setAnswers(nextAnswers)

      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex((index) => index + 1)
        return
      }

      setIsSubmitting(true)
      const { code } = calculateSampleBodyCode(nextAnswers, questions)
      submitSampleResponse(nextAnswers, code).catch(() => {})
      onComplete(code)
    },
    [answers, currentIndex, currentQuestion, isSubmitting, onComplete, questions, totalQuestions],
  )

  if (!currentQuestion) {
    return (
      <QuestionnaireShell current={1} total={12}>
        <div className="p-8 text-center text-gray-600">문항을 불러오지 못했습니다.</div>
      </QuestionnaireShell>
    )
  }

  return (
    <QuestionnaireShell current={currentIndex + 1} total={totalQuestions}>
      <QuestionMediaLayout
        stepKey={currentQuestion.question_code}
        question={currentQuestion}
      >
        <QuestionCard question={currentQuestion} onAnswer={handleAnswer} />
      </QuestionMediaLayout>
    </QuestionnaireShell>
  )
}
