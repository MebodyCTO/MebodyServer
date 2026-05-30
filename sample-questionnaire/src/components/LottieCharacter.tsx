import { useCallback, useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { LOCAL_CHARACTER } from '../assets/localMedia'

interface LottieCharacterProps {
  lottieSrc?: string
  className?: string
}

type DotLottieInstance = {
  addEventListener: (name: string, fn: () => void) => void
  isLoaded?: boolean
}

/**
 * PNG 즉시 표시 → GIF 로드 시 애니메이션 → Lottie 로드 시 크로스페이드
 */
export function LottieCharacter({ lottieSrc, className = '' }: LottieCharacterProps) {
  const [gifReady, setGifReady] = useState(false)
  const [lottieReady, setLottieReady] = useState(false)
  const resolvedLottie = lottieSrc ?? LOCAL_CHARACTER.lottie

  const onLottieRef = useCallback((instance: DotLottieInstance | null) => {
    if (!instance) return
    const onLoad = () => setLottieReady(true)
    instance.addEventListener('load', onLoad)
    if (instance.isLoaded) setLottieReady(true)
  }, [])

  const showPng = !gifReady && !lottieReady
  const showGif = gifReady && !lottieReady

  return (
    <div
      className={`relative mx-auto w-full max-w-[320px] shrink-0 ${className}`}
      style={{ minHeight: 280, aspectRatio: '1 / 1' }}
      data-lottie-character
    >
      <img
        src={LOCAL_CHARACTER.png}
        alt=""
        decoding="sync"
        loading="eager"
        fetchPriority="high"
        className={`absolute inset-0 m-auto h-full w-full object-contain transition-opacity duration-200 ${
          showPng ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <img
        src={LOCAL_CHARACTER.gif}
        alt=""
        decoding="async"
        loading="eager"
        className={`absolute inset-0 m-auto h-full w-full object-contain transition-opacity duration-300 ${
          showGif ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setGifReady(true)}
      />

      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          lottieReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <DotLottieReact
          src={resolvedLottie}
          loop
          autoplay
          dotLottieRefCallback={onLottieRef}
          className="h-full w-full max-h-[320px] max-w-[320px]"
        />
      </div>
    </div>
  )
}
