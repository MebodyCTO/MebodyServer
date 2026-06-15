import rawContent from './sampleResultContent.json'
import type { SampleResultContent } from './sampleResultContent.types'

const CONTENT_BY_CODE = Object.fromEntries(
  (rawContent as SampleResultContent[]).map((entry) => [entry.resultCode, entry]),
) as Record<string, SampleResultContent>

export function getSampleResultContent(code: string): SampleResultContent | undefined {
  return CONTENT_BY_CODE[code.trim().toUpperCase()]
}

export function listSampleResultCodes(): string[] {
  return Object.keys(CONTENT_BY_CODE).sort()
}
