import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'
import type { AnswerMap, AxisKey } from './sampleBodyCodeCalculator'

export interface AxisPercent {
  labelLeft: string
  labelRight: string
  percentLeft: number
  percentRight: number
  isUncertain: boolean
}

const AXIS_LABELS: Record<
  AxisKey,
  { left: string; right: string; scoreAIsLeft: boolean }
> = {
  neck: { left: '목 전방 (F)', right: '목 중립 (C)', scoreAIsLeft: true },
  shoulder: { left: '오른쪽 어깨 높음', right: '왼쪽 어깨 높음', scoreAIsLeft: true },
  pelvis: { left: '오른쪽 회전 (R)', right: '왼쪽 회전 (L)', scoreAIsLeft: true },
  flexibility: { left: '하체 뻣뻣 (S)', right: '하체 유연 (F)', scoreAIsLeft: true },
}

export function getSampleAxisScoreBreakdown(
  answers: AnswerMap,
  questions: SampleQuestion[],
  axisChars: Record<AxisKey, string>,
): Record<AxisKey, AxisPercent> {
  const axisKeys: AxisKey[] = ['neck', 'shoulder', 'pelvis', 'flexibility']
  const result = {} as Record<AxisKey, AxisPercent>

  for (const axis of axisKeys) {
    const labels = AXIS_LABELS[axis]
    const axisChar = axisChars[axis]

    if (axisChar === 'M') {
      result[axis] = {
        labelLeft: labels.left,
        labelRight: labels.right,
        percentLeft: 50,
        percentRight: 50,
        isUncertain: true,
      }
      continue
    }

    const axisQuestions = questions.filter((q) => q.axis === axis && q.is_scored)
    let scoreA = 0
    let scoreB = 0

    for (const question of axisQuestions) {
      const value = answers[question.question_code]
      if (value === '①') scoreA += question.weight_a
      else if (value === '③') scoreB += question.weight_b
    }

    const total = scoreA + scoreB
    const percentA = total > 0 ? Math.round((scoreA / total) * 100) : 50
    const percentB = total > 0 ? Math.round((scoreB / total) * 100) : 50

    result[axis] = {
      labelLeft: labels.left,
      labelRight: labels.right,
      percentLeft: labels.scoreAIsLeft ? percentA : percentB,
      percentRight: labels.scoreAIsLeft ? percentB : percentA,
      isUncertain: false,
    }
  }

  return result
}
