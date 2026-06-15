import { describe, expect, it } from 'vitest'
import { SAMPLE_QUESTIONS_SNAPSHOT } from '../data/sampleQuestionsSnapshot'
import { calculateSampleBodyCode, type AnswerMap, type AnswerValue } from './sampleBodyCodeCalculator'

function answersForAll(value: AnswerValue): AnswerMap {
  return Object.fromEntries(
    SAMPLE_QUESTIONS_SNAPSHOT.map((q) => [q.question_code, value]),
  ) as AnswerMap
}

describe('calculateSampleBodyCode', () => {
  it('returns MMMM when all answers are neutral (②)', () => {
    const { code } = calculateSampleBodyCode(answersForAll('②'), SAMPLE_QUESTIONS_SNAPSHOT)
    expect(code).toBe('MMMM')
  })

  it('returns FRRS when all answers are option 1 (①)', () => {
    const { code } = calculateSampleBodyCode(answersForAll('①'), SAMPLE_QUESTIONS_SNAPSHOT)
    expect(code).toBe('FRRS')
  })

  it('returns M for an axis when A/B weighted scores tie', () => {
    const answers = answersForAll('②')
    answers['1-1'] = '①'
    answers['1-2'] = '③'

    const { code, axisChars } = calculateSampleBodyCode(answers, SAMPLE_QUESTIONS_SNAPSHOT)
    expect(axisChars.neck).toBe('M')
    expect(code.startsWith('M')).toBe(true)
  })
})
