import { getSampleQuestionMediaSet } from '../assets/questionMedia'
import type { SampleQuestion } from '../data/sampleQuestionsSnapshot'

const loadedUrls = new Set<string>()

function preloadImage(src: string): void {
  if (loadedUrls.has(src)) return

  const img = new Image()
  img.decoding = 'async'
  img.onload = () => loadedUrls.add(src)
  img.src = src
}

export function getQuestionPreloadUrls(
  question: SampleQuestion | undefined,
  options: { includeAnswers?: boolean } = {},
): string[] {
  if (!question) return []

  const media = getSampleQuestionMediaSet(question.question_number, question.media_url)
  const urls = options.includeAnswers
    ? [media.main, media.option1, media.option3]
    : [media.main]

  return [...new Set(urls.filter((url): url is string => Boolean(url)))]
}

export function preloadQuestionMedia(
  question: SampleQuestion | undefined,
  options: { includeAnswers?: boolean } = {},
): void {
  getQuestionPreloadUrls(question, options).forEach(preloadImage)
}
