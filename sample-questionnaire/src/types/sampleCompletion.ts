import type { AnswerMap, AxisKey } from '../utils/sampleBodyCodeCalculator'

export interface SampleCompletionPayload {
  code: string
  axisChars: Record<AxisKey, string>
  answers: AnswerMap
}
