import { APP_URL, HOMEPAGE_URL } from '../config/urls'
import { QuestionnaireShell } from './QuestionnaireShell'
import { FadeSlidePanel } from './FadeSlidePanel'

export function SampleCompleteScreen() {
  return (
    <QuestionnaireShell current={12} total={12}>
      <FadeSlidePanel className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2">
          <span className="text-xs font-black tracking-[0.16em] text-emerald-700">SAMPLE</span>
        </div>

        <p
          className="mb-10 max-w-sm text-xl font-bold leading-relaxed text-gray-900 sm:text-2xl"
          style={{ wordBreak: 'keep-all' }}
        >
          샘플문항입니다.
          <br />
          몸 상태가 궁금하시군요?
          <br />
          확실한 코드를 알아보시겠습니까?
        </p>

        <div className="flex w-full max-w-xs flex-col gap-3">
          <a
            href={HOMEPAGE_URL}
            rel="noopener noreferrer"
            className="rounded-2xl border-2 border-gray-200 bg-white py-4 text-center text-base font-semibold text-gray-800 transition-all hover:border-gray-400 active:scale-[0.98]"
          >
            홈으로
          </a>
          <a
            href={APP_URL}
            rel="noopener noreferrer"
            className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-center text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-105 active:scale-[0.98]"
          >
            앱 다운로드
          </a>
        </div>
      </FadeSlidePanel>
    </QuestionnaireShell>
  )
}
