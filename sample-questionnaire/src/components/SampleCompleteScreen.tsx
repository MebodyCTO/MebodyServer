import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { APP_URL, HOMEPAGE_URL } from '../config/urls'
import { AXIS_GREEN_THEME } from '../data/axisTheme'
import { getSampleResultContent } from '../data/sampleResultContent'
import type { SampleCompletionPayload } from '../types/sampleCompletion'
import { getSampleAxisScoreBreakdown } from '../utils/sampleAxisBreakdown'
import type { AxisKey } from '../utils/sampleBodyCodeCalculator'
import { SAMPLE_QUESTIONS_SNAPSHOT } from '../data/sampleQuestionsSnapshot'
import { preloadResultCharacters } from '../utils/preloadResultCharacters'
import { FadeSlidePanel } from './FadeSlidePanel'
import { ResultCharacterHero } from './ResultCharacterHero'

interface SampleCompleteScreenProps {
  result: SampleCompletionPayload
  onRestart: () => void
}

const SCROLL_BOTTOM_THRESHOLD_PX = 32

const AXIS_ORDER: { key: AxisKey; label: string; title: string }[] = [
  { key: 'neck', label: '목', title: '목 방향' },
  { key: 'shoulder', label: '어깨', title: '어깨 높이' },
  { key: 'pelvis', label: '골반', title: '골반 회전' },
  { key: 'flexibility', label: '하체', title: '하체 유연성' },
]

function AxisBar({
  title,
  data,
}: {
  title: string
  data: { labelLeft: string; labelRight: string; percentLeft: number; isUncertain: boolean }
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-800">{title}</p>
        {data.isUncertain ? (
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            M · 방향 미확정
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            예상
          </span>
        )}
      </div>

      <div
        className="relative mb-2 h-3 overflow-hidden rounded-full"
        style={{ backgroundColor: AXIS_GREEN_THEME.track }}
      >
        {data.isUncertain ? (
          <div
            className="h-full w-full opacity-60"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, #E8DCC8 0, #E8DCC8 6px, transparent 6px, transparent 12px)',
            }}
          />
        ) : (
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${data.percentLeft}%`,
              backgroundColor: AXIS_GREEN_THEME.primary,
            }}
          />
        )}
      </div>

      <div className="flex justify-between gap-2 text-[11px] leading-snug">
        <span className={data.isUncertain ? 'text-gray-500' : 'font-medium text-emerald-700'}>
          {data.labelLeft}
        </span>
        <span className="text-right text-gray-400">{data.labelRight}</span>
      </div>
    </div>
  )
}

export function SampleCompleteScreen({ result, onRestart }: SampleCompleteScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasReachedBottom, setHasReachedBottom] = useState(false)
  const content = getSampleResultContent(result.code)
  const breakdown = getSampleAxisScoreBreakdown(
    result.answers,
    SAMPLE_QUESTIONS_SNAPSHOT,
    result.axisChars,
  )
  const chars = result.code.split('')
  const showUncertainCard = content?.hasUncertainAxis ?? result.code.includes('M')

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    const needsScroll = el.scrollHeight > el.clientHeight + 4
    setHasReachedBottom(!needsScroll || remaining <= SCROLL_BOTTOM_THRESHOLD_PX)
  }, [])

  useEffect(() => {
    preloadResultCharacters(result.code)
  }, [result.code])

  useEffect(() => {
    checkScrollPosition()
    const el = scrollRef.current
    if (!el) return

    const observer = new ResizeObserver(checkScrollPosition)
    observer.observe(el)
    return () => observer.disconnect()
  }, [checkScrollPosition, content?.guideText, showUncertainCard])

  const scrollTowardBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({
      top: el.scrollHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [])

  return (
    <FadeSlidePanel className="relative flex max-h-[min(90vh,820px)] flex-col overflow-hidden rounded-3xl bg-[#F7F4EE] shadow-xl">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" onScroll={checkScrollPosition}>
        <div className="relative bg-gradient-to-br from-teal-500 to-teal-600 px-6 pb-8 pt-6 text-white">
          <p className="mb-5 text-center text-sm font-medium text-white/90">나의 MEBODY 코드</p>
          <ResultCharacterHero resultCode={result.code} />
          <div className="mb-4 flex justify-center gap-3 sm:gap-4">
            {chars.map((char, index) => {
              const isUncertain = char === 'M'
              return (
                <div key={`${char}-${index}`} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-black sm:h-16 sm:w-16 sm:text-2xl ${
                      isUncertain
                        ? 'border-2 border-dashed border-white/70 bg-white/10 text-white'
                        : 'bg-white text-teal-600 shadow-md'
                    }`}
                  >
                    {char}
                  </div>
                  <span className="text-[11px] font-medium text-white/85">
                    {AXIS_ORDER[index]?.label}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-center text-sm font-semibold tracking-wide text-white/95">
            {result.code} · 1차 간이 결과
          </p>

          {!hasReachedBottom ? (
            <button
              type="button"
              onClick={scrollTowardBottom}
              className="mt-5 flex w-full flex-col items-center gap-1 text-white/90 transition-colors hover:text-white"
              aria-label="아래로 스크롤하여 전체 결과 보기"
            >
              <span className="text-[11px] font-medium">아래로 스크롤해 전체 결과를 확인해 보세요</span>
              <ChevronDown className="h-6 w-6 animate-scroll-hint-bounce" strokeWidth={2.5} />
            </button>
          ) : null}
        </div>

        <div className="space-y-4 px-4 py-5">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-bold text-teal-600">한 줄 이해</p>
            <p className="text-sm leading-relaxed text-gray-800" style={{ wordBreak: 'keep-all' }}>
              {content?.shortSummary ??
                '결과 설명을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
            </p>
          </div>

          <div>
            <p className="mb-3 px-1 text-xs font-medium text-gray-500">축별 결과 · 12문항 기반</p>
            <div className="space-y-3">
              {AXIS_ORDER.map(({ key, title }) => (
                <AxisBar key={key} title={title} data={breakdown[key]} />
              ))}
            </div>
          </div>

          {showUncertainCard ? (
            <div className="rounded-2xl border border-dashed border-teal-300 bg-amber-50/60 p-4">
              <p className="text-sm font-bold text-teal-800">
                {content?.uncertainAxes?.length
                  ? `${content.uncertainAxes
                      .map((axis) => AXIS_ORDER.find((item) => item.key === axis)?.label)
                      .filter(Boolean)
                      .join(' · ')} 방향이 아직 미확정이에요.`
                  : '일부 축 방향이 아직 미확정이에요.'}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-gray-600" style={{ wordBreak: 'keep-all' }}>
                1차 12문항만으로는 방향을 특정하기 어려운 축이 있어요. 2차 정밀 체크에서 더 자세히 확인할 수
                있습니다.
              </p>
            </div>
          ) : null}

          {content?.guideText ? (
            <a
              href={APP_URL}
              rel="noopener noreferrer"
              className="block rounded-2xl border border-teal-100 bg-white p-5 shadow-sm transition-all hover:border-teal-300 hover:shadow-md active:scale-[0.99]"
            >
              <p className="mb-2 text-xs font-bold text-teal-600">앱에서 더 자세히 확인하기</p>
              <p className="text-sm leading-relaxed text-gray-800" style={{ wordBreak: 'keep-all' }}>
                {content.guideText}
              </p>
              <span className="mt-4 block rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-500/20">
                앱 다운로드
              </span>
            </a>
          ) : null}
        </div>
      </div>

      {!hasReachedBottom ? (
        <p
          className="shrink-0 border-t border-amber-100 bg-amber-50/90 px-4 py-2 text-center text-[11px] leading-snug text-amber-800/80"
          style={{ wordBreak: 'keep-all' }}
        >
          아래까지 스크롤하면 홈페이지·처음으로를 사용할 수 있어요
        </p>
      ) : null}

      <div className="shrink-0 space-y-2 border-t border-gray-200 bg-white p-4">
        {hasReachedBottom ? (
          <a
            href={HOMEPAGE_URL}
            rel="noopener noreferrer"
            className="block rounded-2xl border-2 border-gray-200 bg-white py-3.5 text-center text-sm font-semibold text-gray-800 transition-all hover:border-gray-400 active:scale-[0.98]"
          >
            홈페이지
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-2xl border-2 border-gray-100 bg-gray-50 py-3.5 text-center text-sm font-semibold text-gray-300"
          >
            홈페이지
          </button>
        )}
        {hasReachedBottom ? (
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-2xl py-2 text-center text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            처음으로
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-2xl py-2 text-center text-sm font-medium text-gray-300"
          >
            처음으로
          </button>
        )}
      </div>
    </FadeSlidePanel>
  )
}
