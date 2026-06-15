import { resolveQuestionMedia } from '../assets/questionMedia'
import { SAMPLE_QUESTIONS_SNAPSHOT, type SampleQuestion } from '../data/sampleQuestionsSnapshot'

const PRELOAD_GAP_MS = 100
const loadedUrls = new Set<string>()

function preloadImage(src: string): Promise<void> {
  if (loadedUrls.has(src)) return Promise.resolve()

  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      loadedUrls.add(src)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = src
  })
}

function runWhenIdle(task: () => void, delayMs: number): void {
  const run = () => setTimeout(task, delayMs)
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run)
    return
  }
  run()
}

export function getSampleGifUrls(questions: SampleQuestion[] = SAMPLE_QUESTIONS_SNAPSHOT): string[] {
  return [...new Set(questions.map((q) => resolveQuestionMedia(q.media_url).gif))]
}

/**
 * q01~q12 GIF를 백그라운드에서 순차 preload한다.
 * priorityMediaKey(또는 첫 문항)를 먼저 로드한 뒤 나머지를 분산 로드한다.
 */
export function preloadSampleGif(src: string): void {
  void preloadImage(src)
}

export function preloadAllSampleGifs(
  questions: SampleQuestion[] = SAMPLE_QUESTIONS_SNAPSHOT,
  priorityMediaKey?: string,
): void {
  const allUrls = getSampleGifUrls(questions)
  const priorityUrl = priorityMediaKey
    ? resolveQuestionMedia(priorityMediaKey).gif
    : resolveQuestionMedia(questions[0]?.media_url).gif

  const ordered = [priorityUrl, ...allUrls.filter((url) => url !== priorityUrl)]

  ordered.forEach((src, index) => {
    runWhenIdle(() => {
      void preloadImage(src)
    }, index * PRELOAD_GAP_MS)
  })
}
