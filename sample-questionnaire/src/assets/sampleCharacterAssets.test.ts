import { describe, expect, it } from 'vitest'
import {
  DEFINITIVE_BODY_CODES,
  getCharacterImageUrl,
  getCompatibleCharacterCodes,
  isDefinitiveSampleCode,
} from './sampleCharacterAssets'

describe('getCompatibleCharacterCodes', () => {
  it('returns a single code for definitive results without M', () => {
    expect(getCompatibleCharacterCodes('CLLF')).toEqual(['CLLF'])
    expect(getCompatibleCharacterCodes('frrs')).toEqual(['FRRS'])
  })

  it('expands pelvis M into two compatible codes', () => {
    expect(getCompatibleCharacterCodes('CLMF')).toEqual(['CLRF', 'CLLF'])
  })

  it('expands two M axes into four codes for MRMS', () => {
    expect(getCompatibleCharacterCodes('MRMS')).toEqual(['FRRS', 'FRLS', 'CRRS', 'CRLS'])
  })

  it('expands three M axes into eight codes ending in S', () => {
    expect(getCompatibleCharacterCodes('MMMS')).toEqual([
      'FRRS',
      'FRLS',
      'FLRS',
      'FLLS',
      'CRRS',
      'CRLS',
      'CLRS',
      'CLLS',
    ])
  })

  it('returns all 16 codes for MMMM', () => {
    expect(getCompatibleCharacterCodes('MMMM')).toEqual([...DEFINITIVE_BODY_CODES])
  })

  it('returns empty array for invalid code length', () => {
    expect(getCompatibleCharacterCodes('CLL')).toEqual([])
  })
})

describe('isDefinitiveSampleCode', () => {
  it('is true only for M-free definitive codes', () => {
    expect(isDefinitiveSampleCode('CLLF')).toBe(true)
    expect(isDefinitiveSampleCode('CLMF')).toBe(false)
  })
})

describe('getCharacterImageUrl', () => {
  it('builds public character path from code', () => {
    expect(getCharacterImageUrl('CLLF')).toBe('/sample/sample-media/characters/CLLF.png')
  })
})
