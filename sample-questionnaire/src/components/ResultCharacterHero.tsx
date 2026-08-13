import { useEffect, useMemo, useState } from 'react'
import {
  getCharacterImageUrl,
  getCompatibleCharacterCodes,
} from '../assets/sampleCharacterAssets'
import { LOCAL_CHARACTER } from '../assets/localMedia'

interface ResultCharacterHeroProps {
  resultCode: string
}

const CAROUSEL_INTERVAL_MS = 500

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
  const prefersReducedMotion = usePrefersReducedMotion()
  // M 축이 있으면 후보 PNG를 순환. 확정 16코드는 단일 PNG + idle 모션.
  const shouldCarousel = compatibleCodes.length > 1 && !prefersReducedMotion
  const shouldIdle = compatibleCodes.length >= 1 && !prefersReducedMotion

  const [activeIndex, setActiveIndex] = useState(0)
  const [imageSrc, setImageSrc] = useState(() => {
    const firstCode = compatibleCodes[0]
    return firstCode ? getCharacterImageUrl(firstCode) : LOCAL_CHARACTER.png
  })

  useEffect(() => {
    const firstCode = compatibleCodes[0]
    setActiveIndex(0)
    setImageSrc(firstCode ? getCharacterImageUrl(firstCode) : LOCAL_CHARACTER.png)
  }, [compatibleCodes])

  useEffect(() => {
    if (!shouldCarousel) return

    const timer = window.setInterval(() => {
      setActiveIndex((index) => {
        const nextIndex = (index + 1) % compatibleCodes.length
        setImageSrc(getCharacterImageUrl(compatibleCodes[nextIndex]!))
        return nextIndex
      })
    }, CAROUSEL_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [compatibleCodes, shouldCarousel])

  const handleImageError = () => {
    setImageSrc(LOCAL_CHARACTER.png)
  }

  const imageClassName = [
    'h-[120px] w-[120px] rounded-2xl object-contain transition-opacity duration-300',
    shouldIdle ? 'animate-character-idle' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (compatibleCodes.length === 0) {
    return (
      <div className="mb-4 flex justify-center">
        <img
          src={LOCAL_CHARACTER.png}
          alt="MEBODY 캐릭터"
          className={[
            'h-[120px] w-[120px] rounded-2xl object-contain',
            prefersReducedMotion ? '' : 'animate-character-idle',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </div>
    )
  }

  return (
    <div className="mb-4 flex justify-center">
      <img
        key={`${compatibleCodes[activeIndex]}-${imageSrc}`}
        src={imageSrc}
        alt={
          compatibleCodes.length === 1
            ? `${resultCode} MEBODY 캐릭터`
            : `MEBODY 캐릭터 후보 ${activeIndex + 1}/${compatibleCodes.length}`
        }
        className={imageClassName}
        onError={handleImageError}
      />
    </div>
  )
}
