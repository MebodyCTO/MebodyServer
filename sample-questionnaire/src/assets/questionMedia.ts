import { LOCAL_CHARACTER } from './localMedia'
import type { AnswerValue } from '../utils/sampleBodyCodeCalculator'

export interface QuestionMedia {
  lottie: string
  gif: string
}

export interface SampleQuestionMediaSet {
  main: string
  option1?: string
  option3?: string
}

/**
 * 기존 media_url(q01~q12) 호환용 경로 생성기.
 * 새 간이 문항 화면은 아래 문항 번호별 매핑을 우선한다.
 */
const GIF_KEY_ALIAS: Record<string, string> = {
  q02: 'q01',
  q03: 'q01',
}

function normalizeGifKey(key: string): string {
  const lower = key.toLowerCase()
  return GIF_KEY_ALIAS[lower] ?? lower
}

function buildFromKey(key: string): QuestionMedia {
  const normalized = key.toLowerCase()
  const gifKey = normalizeGifKey(normalized)
  return {
    lottie: `${import.meta.env.BASE_URL}sample-media/lottie/${normalized}.lottie`,
    gif: `${import.meta.env.BASE_URL}sample-media/gif/${gifKey}.gif`,
  }
}

const questionAsset = (filename: string) =>
  `${import.meta.env.BASE_URL}sample-media/questions/${filename}`

const legacyGif = (questionNumber: 10 | 12) =>
  `${import.meta.env.BASE_URL}sample-media/gif/q${String(questionNumber).padStart(2, '0')}.gif`

/**
 * 간이 문항 미디어는 DB media_url보다 문항 번호를 우선한다.
 * 2·3번은 동일 세트를 공유하고, 10·12번은 기존 GIF 동작을 유지한다.
 */
const QUESTION_MEDIA_BY_NUMBER: Record<number, SampleQuestionMediaSet> = {
  1: {
    main: questionAsset('q01-main.webp'),
    option1: questionAsset('q01-option-1.webp'),
    option3: questionAsset('q01-option-3.webp'),
  },
  2: {
    main: questionAsset('q02-main.webp'),
    option1: questionAsset('q02-option-1.webp'),
    option3: questionAsset('q02-option-3.webp'),
  },
  3: {
    main: questionAsset('q02-main.webp'),
    option1: questionAsset('q02-option-1.webp'),
    option3: questionAsset('q02-option-3.webp'),
  },
  4: {
    main: questionAsset('q04-main.webp'),
    option1: questionAsset('q04-option-1.webp'),
    option3: questionAsset('q04-option-3.webp'),
  },
  5: {
    main: questionAsset('q05-main.webp'),
    option1: questionAsset('q05-option-1.webp'),
    option3: questionAsset('q05-option-3.webp'),
  },
  6: {
    main: questionAsset('q06-main.webp'),
    option1: questionAsset('q06-option-1.webp'),
    option3: questionAsset('q06-option-3.webp'),
  },
  7: {
    main: questionAsset('q07-main.webp'),
    option1: questionAsset('q07-option-1.webp'),
    option3: questionAsset('q07-option-3.webp'),
  },
  8: {
    main: questionAsset('q08-main.webp'),
    option1: questionAsset('q08-option-1.webp'),
    option3: questionAsset('q08-option-3.webp'),
  },
  9: {
    main: questionAsset('q09-main.webp'),
    option1: questionAsset('q09-option-1.webp'),
    option3: questionAsset('q09-option-3.webp'),
  },
  10: { main: legacyGif(10) },
  11: {
    main: questionAsset('q11-main.webp'),
    option1: questionAsset('q11-option-1.webp'),
    option3: questionAsset('q11-option-3.webp'),
  },
  12: { main: legacyGif(12) },
}

/**
 * DB에서 절대 URL이 오면 그대로 사용, 키면 로컬 규칙으로 변환.
 */
export function resolveQuestionMedia(mediaUrl?: string): QuestionMedia {
  if (!mediaUrl) {
    return { lottie: LOCAL_CHARACTER.lottie, gif: LOCAL_CHARACTER.gif }
  }

  const trimmed = mediaUrl.trim()
  if (!trimmed) {
    return { lottie: LOCAL_CHARACTER.lottie, gif: LOCAL_CHARACTER.gif }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { lottie: trimmed, gif: LOCAL_CHARACTER.gif }
  }

  // 키 형식(q01~q12) 또는 파일명(q01.lottie)
  const key = trimmed.replace(/\.lottie$/i, '').replace(/\.gif$/i, '')
  if (/^q\d{2}$/i.test(key)) return buildFromKey(key.toLowerCase())

  return { lottie: LOCAL_CHARACTER.lottie, gif: LOCAL_CHARACTER.gif }
}

export function getSampleQuestionMediaSet(
  questionNumber: number,
  fallbackMediaUrl?: string,
): SampleQuestionMediaSet {
  const localSet = QUESTION_MEDIA_BY_NUMBER[questionNumber]
  if (localSet) return localSet

  return { main: resolveQuestionMedia(fallbackMediaUrl).gif }
}

export function resolveSampleAnswerMedia(
  questionNumber: number,
  answer: AnswerValue | undefined,
  fallbackMediaUrl?: string,
): string | undefined {
  if (!answer || answer === '②') return undefined

  const media = getSampleQuestionMediaSet(questionNumber, fallbackMediaUrl)
  if (answer === '①') return media.option1 ?? media.main
  return media.option3 ?? media.main
}
