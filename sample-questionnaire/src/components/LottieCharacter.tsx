import { useEffect, useRef, useState } from 'react'

interface LottieCharacterProps {
  mediaKey: string
  gifSrc: string
  className?: string
}

function isImageLoaded(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalHeight > 0)
}

/**
 * GIF 단일 표시 정책:
 * - 프리로드된 GIF는 onLoad가 effect보다 먼저 끝날 수 있어 complete도 확인
 * - 이미지는 항상 opacity-100 (캐시 레이스로 숨겨지지 않게)
 */
export function LottieCharacter({ mediaKey, gifSrc, className = '' }: LottieCharacterProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [gifReady, setGifReady] = useState(false)

  useEffect(() => {
    setGifReady(false)

    const el = imgRef.current
    if (isImageLoaded(el)) {
      setGifReady(true)
      return
    }

    const probe = new Image()
    const markReady = () => setGifReady(true)
    probe.onload = markReady
    probe.onerror = markReady
    probe.src = gifSrc
    if (probe.complete && probe.naturalHeight > 0) {
      markReady()
    }

    return () => {
      probe.onload = null
      probe.onerror = null
    }
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
        ref={imgRef}
        key={gifSrc}
        src={gifSrc}
        alt=""
        decoding="async"
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 m-auto h-full w-full object-contain opacity-100"
        onLoad={() => setGifReady(true)}
        onError={() => setGifReady(true)}
      />
    </div>
  )
}
