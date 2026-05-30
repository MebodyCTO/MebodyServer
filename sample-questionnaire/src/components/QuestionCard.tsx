import { Check } from 'lucide-react'
import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'
import type { AnswerValue } from '../utils/sampleBodyCodeCalculator'

interface QuestionCardProps {
  question: SampleQuestion
  onAnswer: (value: AnswerValue) => void
}

const axisShortLabels: Record<SampleQuestion['axis'], string> = {
  neck: '목',
  shoulder: '어깨',
  pelvis: '골반',
  flexibility: '하체',
}

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const options: { value: AnswerValue; label: string; muted?: boolean }[] = [
    { value: '①', label: question.option_1 },
    { value: '②', label: question.option_2, muted: true },
    { value: '③', label: question.option_3 },
  ]

  return (
    <>
      <div className="mb-5 inline-flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <span className="text-sm font-semibold text-emerald-600">{question.question_number}</span>
        </div>
        <span className="text-sm text-gray-500">
          {question.axis_label || `${axisShortLabels[question.axis]} 측정`}
        </span>
      </div>

      <h2
        className="mb-8 text-xl font-bold leading-relaxed text-gray-900 sm:text-2xl"
        style={{ wordBreak: 'keep-all' }}
      >
        {question.question_text}
      </h2>

      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onAnswer(option.value)}
            className={`group flex w-full items-center justify-between rounded-2xl border-2 px-5 py-5 text-left font-semibold transition-all active:scale-[0.98] ${
              option.muted
                ? 'border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                : 'border-gray-200 text-gray-900 hover:border-emerald-500 hover:bg-emerald-50'
            }`}
          >
            <span className="pr-3 text-base leading-snug" style={{ wordBreak: 'keep-all' }}>
              {option.label}
            </span>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                option.muted
                  ? 'border-gray-300 group-hover:border-gray-400'
                  : 'border-gray-300 group-hover:border-emerald-500 group-hover:bg-emerald-500'
              }`}
            >
              <Check
                className={`h-5 w-5 transition-colors ${
                  option.muted
                    ? 'text-transparent'
                    : 'text-transparent group-hover:text-white'
                }`}
              />
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
