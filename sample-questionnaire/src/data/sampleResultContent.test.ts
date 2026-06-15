import { describe, expect, it } from 'vitest'
import { getSampleResultContent, listSampleResultCodes } from '../data/sampleResultContent'

describe('sampleResultContent', () => {
  it('contains 81 result codes', () => {
    expect(listSampleResultCodes()).toHaveLength(81)
  })

  it('maps MRMS copy', () => {
    const content = getSampleResultContent('MRMS')
    expect(content?.resultCode).toBe('MRMS')
    expect(content?.hasUncertainAxis).toBe(true)
    expect(content?.uncertainAxes).toEqual(['neck', 'pelvis'])
    expect(content?.shortSummary).toContain('오른쪽 어깨')
  })

  it('maps MMMM copy', () => {
    const content = getSampleResultContent('MMMM')
    expect(content?.hasUncertainAxis).toBe(true)
    expect(content?.uncertainAxes).toHaveLength(4)
  })

  it('maps FRRS copy', () => {
    const content = getSampleResultContent('FRRS')
    expect(content?.hasUncertainAxis).toBe(false)
    expect(content?.neckResult).toBe('F')
    expect(content?.shortSummary).toContain('목이 앞으로')
  })
})
