import type { ReactNode } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { HOMEPAGE_URL, APP_URL } from '../config/urls'
import { ProgressBar } from './ProgressBar'

interface QuestionnaireShellProps {
  current: number
  total: number
  children: ReactNode
}

/** 12문항·완료 화면 공통 상단(홈·브랜드·프로그레스) */
export function QuestionnaireShell({ current, total, children }: QuestionnaireShellProps) {
  return (
    <div className="mebody-app-surface overflow-hidden rounded-3xl shadow-xl" style={{ minHeight: '100dvh' }}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-6 pt-6">
          <a
            href={HOMEPAGE_URL}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            홈페이지
          </a>
          <a
            href={APP_URL}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md active:scale-[0.98]"
            aria-label="MEBODY 앱 다운로드"
          >
            <Sparkles size={16} color="#014725" />
            <span className="text-xs font-black tracking-wide text-gray-800">MEBODY</span>
          </a>
        </div>

        <ProgressBar current={current} total={total} />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
