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
  const shouldCarousel = compatibleCodes.length > 1 && !prefersReducedMotion

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

  if (compatibleCodes.length === 0) {
    return (
      <div className="mb-4 flex justify-center">
        <img
          src={LOCAL_CHARACTER.png}
          alt="MEBODY 캐릭터"
          className="h-[120px] w-[120px] rounded-2xl object-contain"
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
        className="h-[120px] w-[120px] rounded-2xl object-contain transition-opacity duration-300"
        onError={handleImageError}
      />
    </div>
  )
}
