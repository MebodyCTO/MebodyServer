import {
  getCharacterImageUrl,
  getCompatibleCharacterCodes,
} from '../assets/sampleCharacterAssets'

const PRELOAD_GAP_MS = 100
const loadedUrls = new Set<string>()

function preloadImage(src: string): Promise<void> {
  if (loadedUrls.has(src)) return Promise.resolve()

  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      loadedUrls.add(src)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = src
  })
}

function runWhenIdle(task: () => void, delayMs: number): void {
  const run = () => setTimeout(task, delayMs)
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run)
    return
  }
  run()
}

export function preloadResultCharacters(resultCode: string): void {
  const codes = getCompatibleCharacterCodes(resultCode)
  codes.forEach((code, index) => {
    runWhenIdle(() => {
      void preloadImage(getCharacterImageUrl(code))
    }, index * PRELOAD_GAP_MS)
  })
}
