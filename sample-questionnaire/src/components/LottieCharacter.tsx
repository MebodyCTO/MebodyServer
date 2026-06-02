import { useEffect, useState } from 'react'

interface LottieCharacterProps {
  mediaKey: string
  gifSrc: string
  className?: string
}

/**
 * GIF 단일 표시 정책:
 * - 현재 문항 GIF가 준비되기 전에는 스켈레톤 노출
 * - 다른 문항 이미지 노출 금지
 */
export function LottieCharacter({ mediaKey, gifSrc, className = '' }: LottieCharacterProps) {
  const [gifReady, setGifReady] = useState(false)

  useEffect(() => {
    setGifReady(false)
  }, [mediaKey, gifSrc])

  return (
    <div
      className={`relative mx-auto w-full max-w-[320px] shrink-0 ${className}`}
      style={{ minHeight: 280, aspectRatio: '1 / 1' }}
      data-lottie-character
    >
      {!gifReady ? (
        <div className="absolute inset-0 m-auto h-full w-full animate-pulse rounded-3xl bg-emerald-50" />
      ) : null}
      <img
        src={gifSrc}
        alt=""
        decoding="async"
        loading="eager"
        fetchPriority="high"
        className={`absolute inset-0 m-auto h-full w-full object-contain transition-opacity duration-150 ${
          gifReady ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setGifReady(true)}
        onError={() => setGifReady(false)}
      />
    </div>
  )
}
