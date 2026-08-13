export const DEFINITIVE_BODY_CODES = [
  'FRRS',
  'FRRF',
  'FRLS',
  'FRLF',
  'FLRS',
  'FLRF',
  'FLLS',
  'FLLF',
  'CRRS',
  'CRRF',
  'CRLS',
  'CRLF',
  'CLRS',
  'CLRF',
  'CLLS',
  'CLLF',
] as const

export type DefinitiveBodyCode = (typeof DEFINITIVE_BODY_CODES)[number]

const DEFINITIVE_CODE_SET = new Set<string>(DEFINITIVE_BODY_CODES)

function normalizeResultCode(code: string): string {
  return String(code ?? '')
    .trim()
    .toUpperCase()
}

function expandAxisChar(char: string, axisIndex: number): string[] {
  if (char !== 'M') return [char]

  if (axisIndex === 0) return ['F', 'C']
  if (axisIndex === 3) return ['S', 'F']
  return ['R', 'L']
}

/**
 * M 축을 F/C·R/L·S/F 양쪽으로 펼친 뒤 16코드 목록과 교집합을 반환한다.
 * M 없는 확정 코드도 목축(F↔C) 페어를 넣어 MRRS처럼 캐러셀되게 한다.
 * 예: FRRS → [FRRS, CRRS], MRRS → [FRRS, CRRS]
 */
export function getCompatibleCharacterCodes(code: string): DefinitiveBodyCode[] {
  const normalized = normalizeResultCode(code)
  if (normalized.length !== 4) return []

  const axisOptions = normalized.split('').map((char, index) => expandAxisChar(char, index))

  let expanded: string[] = ['']
  for (const options of axisOptions) {
    expanded = expanded.flatMap((prefix) => options.map((option) => prefix + option))
  }

  // 확정 코드(M 없음): 목축 반대 코드도 넣어 캐러셀 (MRRS와 동일 패턴)
  if (!normalized.includes('M') && DEFINITIVE_CODE_SET.has(normalized)) {
    const neckAlt = normalized[0] === 'F' ? 'C' : 'F'
    expanded.push(`${neckAlt}${normalized.slice(1)}`)
  }

  const expandedSet = new Set(expanded)
  return DEFINITIVE_BODY_CODES.filter((definitiveCode) => expandedSet.has(definitiveCode))
}

export function isDefinitiveSampleCode(code: string): boolean {
  const normalized = normalizeResultCode(code)
  return !normalized.includes('M') && DEFINITIVE_CODE_SET.has(normalized)
}

export function getCharacterImageUrl(code: string): string {
  const normalized = normalizeResultCode(code)
  return `${import.meta.env.BASE_URL}sample-media/characters/${normalized}.png`
}
