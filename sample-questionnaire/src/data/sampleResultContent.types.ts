export type SampleUncertainAxis = 'neck' | 'shoulder' | 'pelvis' | 'flexibility'

export interface SampleResultContent {
  resultCode: string
  neckResult: string
  shoulderResult: string
  pelvisResult: string
  lowerBodyResult: string
  hasUncertainAxis: boolean
  uncertainAxes: SampleUncertainAxis[]
  shortSummary: string
  guideText: string
}
