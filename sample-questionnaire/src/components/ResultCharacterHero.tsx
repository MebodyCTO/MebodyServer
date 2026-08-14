import { useEffect, useMemo, useState } from 'react'
import {
  getCharacterImageUrl,
  getCompatibleCharacterCodes,
} from '../assets/sampleCharacterAssets'
import { LOCAL_CHARACTER } from '../assets/localMedia'

interface ResultCharacterHeroProps {
  resultCode: string
}

/** 후보 교체 간격 — 너무 짧으면 깜빡임처럼 보임 */
const CAROUSEL_INTERVAL_MS = 1600

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return prefersReducedMotion
}

export function ResultCharacterHero({ resultCode }: ResultCharacterHeroProps) {
  const compatibleCodes = useMemo(
    () => getCompatibleCharacterCodes(resultCode),
    [resultCode],
  )
  const imageUrls = useMemo(
    () =>
      compatibleCodes.length > 0
        ? compatibleCodes.map((code) => getCharacterImageUrl(code))
        : [LOCAL_CHARACTER.png],
    [compatibleCodes],
  )
  const prefersReducedMotion = usePrefersReducedMotion()
  const shouldCarousel = imageUrls.length > 1 && !prefersReducedMotion
  const shouldIdle = !prefersReducedMotion

  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [imageUrls])

  // 후보 이미지 미리 로드 — 교체 시 빈 프레임/깜빡임 방지
  useEffect(() => {
    imageUrls.forEach((url) => {
      const preload = new Image()
      preload.src = url
    })
  }, [imageUrls])

  useEffect(() => {
    if (!shouldCarousel) return

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % imageUrls.length)
    }, CAROUSEL_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [imageUrls, shouldCarousel])

  return (
    <div className="mb-4 flex justify-center">
      <div
        className={[
          'relative h-[120px] w-[120px]',
          shouldIdle ? 'animate-character-idle' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {imageUrls.map((url, index) => (
          <img
            key={url}
            src={url}
            alt={
              imageUrls.length === 1
                ? `${resultCode} MEBODY 캐릭터`
                : `MEBODY 캐릭터 후보 ${index + 1}/${imageUrls.length}`
            }
            className={[
              'absolute inset-0 h-full w-full rounded-2xl object-contain',
              // src 교체/리마운트 없이 opacity만 바꿔 깜빡임 제거
              'transition-opacity duration-700 ease-in-out',
              index === activeIndex ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            onError={(event) => {
              event.currentTarget.src = LOCAL_CHARACTER.png
            }}
          />
        ))}
      </div>
    </div>
  )
}
