import { describe, expect, it } from 'vitest'
import { getSampleQuestionMediaSet, resolveSampleAnswerMedia } from './questionMedia'

describe('sample question media mapping', () => {
  it('maps main and option media by question number', () => {
    expect(getSampleQuestionMediaSet(1)).toEqual({
      main: '/sample/sample-media/questions/q01-main.webp',
      option1: '/sample/sample-media/questions/q01-option-1.webp',
      option3: '/sample/sample-media/questions/q01-option-3.webp',
    })
    expect(resolveSampleAnswerMedia(1, '①')).toBe(
      '/sample/sample-media/questions/q01-option-1.webp',
    )
    expect(resolveSampleAnswerMedia(1, '③')).toBe(
      '/sample/sample-media/questions/q01-option-3.webp',
    )
  })

  it('shares the same media set between questions 2 and 3', () => {
    expect(getSampleQuestionMediaSet(3)).toEqual(getSampleQuestionMediaSet(2))
  })

  it('does not return answer media for the uncertain option', () => {
    for (let questionNumber = 1; questionNumber <= 12; questionNumber += 1) {
      expect(resolveSampleAnswerMedia(questionNumber, '②')).toBeUndefined()
    }
  })

  it('keeps the existing media behavior for questions 10 and 12', () => {
    expect(getSampleQuestionMediaSet(10).main).toBe('/sample/sample-media/gif/q10.gif')
    expect(resolveSampleAnswerMedia(10, '①')).toBe('/sample/sample-media/gif/q10.gif')
    expect(getSampleQuestionMediaSet(12).main).toBe('/sample/sample-media/gif/q12.gif')
    expect(resolveSampleAnswerMedia(12, '③')).toBe('/sample/sample-media/gif/q12.gif')
  })

  it('falls back to the existing media resolver for unknown question numbers', () => {
    expect(getSampleQuestionMediaSet(99, 'q04').main).toBe('/sample/sample-media/gif/q04.gif')
  })
})
