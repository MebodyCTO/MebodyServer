/**
 * 로컬 번들 미디어 — 첫 페인트 즉시 표시 (DB/네트워크 대기 없음).
 * DB 연동 시 question.media_url 로 교체 예정.
 */
import characterPng from './character.png'
import characterGif from './character.gif'
import characterLottieUrl from './character.lottie?url'

export const LOCAL_CHARACTER = {
  png: characterPng,
  gif: characterGif,
  lottie: characterLottieUrl,
} as const
