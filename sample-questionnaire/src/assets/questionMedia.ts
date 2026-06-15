import { LOCAL_CHARACTER } from './localMedia'

export interface QuestionMedia {
  lottie: string
  gif: string
}

/**
 * media_url가 q01~q12 같은 키이면 문항별 파일 경로를 생성한다.
 * 1~3번(목 축)은 동일 GIF(q01)를 사용한다.
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
