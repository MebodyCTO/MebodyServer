import rawContent from './sampleResultContent.json'
import type { SampleResultContent } from './sampleResultContent.types'

function normalizeCheckCopy(text: string): string {
  return text.replaceAll('2차 정밀 체크', '정밀 체크').replaceAll('2차 체크', '정밀 체크')
}

const CONTENT_BY_CODE = Object.fromEntries(
  (rawContent as SampleResultContent[]).map((entry) => [
    entry.resultCode,
    {
      ...entry,
      shortSummary: normalizeCheckCopy(entry.shortSummary),
      guideText: normalizeCheckCopy(entry.guideText),
    },
  ]),
) as Record<string, SampleResultContent>

export function getSampleResultContent(code: string): SampleResultContent | undefined {
  return CONTENT_BY_CODE[code.trim().toUpperCase()]
}

export function listSampleResultCodes(): string[] {
  return Object.keys(CONTENT_BY_CODE).sort()
}
