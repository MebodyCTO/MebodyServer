interface ProgressBarProps {
  current: number
  total: number
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = total > 0 ? (current / total) * 100 : 0

  return (
    <div className="px-6 pb-4 pt-8">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">
          질문 {current} / {total}
        </span>
        <span className="text-sm font-semibold text-emerald-600">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
