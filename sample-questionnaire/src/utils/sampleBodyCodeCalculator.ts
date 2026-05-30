import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'

export type AnswerValue = '①' | '②' | '③'
export type AnswerMap = Record<string, AnswerValue>
export type AxisKey = 'neck' | 'shoulder' | 'pelvis' | 'flexibility'

export interface SampleBodyCodeResult {
  code: string
  axisChars: Record<AxisKey, string>
}

const AXIS_KEYS: AxisKey[] = ['neck', 'shoulder', 'pelvis', 'flexibility']

function isNeutralAnswer(value: AnswerValue | undefined): boolean {
  return value === '②'
}

function isAnswerA(value: AnswerValue | undefined): boolean {
  return value === '①'
}

function isAnswerB(value: AnswerValue | undefined): boolean {
  return value === '③'
}

function resolveAxisChar(
  axis: AxisKey,
  scoreA: number,
  scoreB: number,
  allNeutral: boolean,
): string {
  if (allNeutral || scoreA === scoreB) return 'M'

  if (axis === 'neck') return scoreA >= scoreB ? 'F' : 'C'
  if (axis === 'shoulder' || axis === 'pelvis') return scoreA >= scoreB ? 'R' : 'L'
  return scoreA >= scoreB ? 'S' : 'F'
}

export function calculateSampleBodyCode(
  answers: AnswerMap,
  questions: SampleQuestion[],
): SampleBodyCodeResult {
  const axisChars = {} as Record<AxisKey, string>
  let code = ''

  for (const axis of AXIS_KEYS) {
    const axisQuestions = questions.filter((q) => q.axis === axis && q.is_scored)
    let scoreA = 0
    let scoreB = 0
    let allNeutral = axisQuestions.length > 0

    for (const question of axisQuestions) {
      const value = answers[question.question_code]
      if (isAnswerA(value)) {
        scoreA += question.weight_a
        allNeutral = false
      } else if (isAnswerB(value)) {
        scoreB += question.weight_b
        allNeutral = false
      } else if (!isNeutralAnswer(value)) {
        allNeutral = false
      }
    }

    const char = resolveAxisChar(axis, scoreA, scoreB, allNeutral)
    axisChars[axis] = char
    code += char
  }

  return { code, axisChars }
}
