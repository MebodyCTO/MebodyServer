import { LOCAL_CHARACTER } from './localMedia'

export interface QuestionMedia {
  lottie: string
  gif: string
}

/**
 * media_url가 q01~q12 같은 키이면 문항별 파일 경로를 생성한다.
 * 파일 배치:
 * - public/sample-media/lottie/q01.lottie ... q12.lottie
 * - public/sample-media/gif/q01.gif ... q12.gif
 */
function buildFromKey(key: string): QuestionMedia {
  return {
    lottie: `${import.meta.env.BASE_URL}sample-media/lottie/${key}.lottie`,
    gif: `${import.meta.env.BASE_URL}sample-media/gif/${key}.gif`,
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
