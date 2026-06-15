#!/usr/bin/env node
/**
 * Import sample result page copy from a TSV export (same columns as the Excel source).
 *
 * Usage:
 *   node scripts/import-sample-result-tsv.mjs [input.tsv] [output.json]
 *
 * Defaults:
 *   input:  ./sample-result-content.tsv
 *   output: ./src/data/sampleResultContent.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const AXIS_MAP = {
  목: 'neck',
  어깨: 'shoulder',
  골반: 'pelvis',
  하체: 'flexibility',
}

const FCM = ['F', 'C', 'M']
const RLM = ['R', 'L', 'M']
const SFM = ['S', 'F', 'M']

function parseUncertainAxes(raw) {
  const s = String(raw ?? '').trim()
  if (!s || s === '-') return []
  return s
    .split(/[,，、]/)
    .map((p) => p.trim())
    .filter((p) => p && p !== '-')
    .map((p) => AXIS_MAP[p] ?? p)
    .filter((mapped, i, arr) => arr.indexOf(mapped) === i)
}

function parseYn(raw) {
  return String(raw ?? '').trim().toUpperCase() === 'Y'
}

function cellStr(raw) {
  if (raw == null) return ''
  const s = String(raw).trim()
  return s === 'nan' ? '' : s
}

/** @param {string} text */
function parseTsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.length > 0)
  if (lines.length < 2) return []

  const headers = lines[0].split('\t').map((h) => h.trim())
  const idx = (name) => {
    const i = headers.indexOf(name)
    if (i === -1) throw new Error(`Missing column: ${name}`)
    return i
  }

  const col = {
    code: idx('코드'),
    neck: idx('1축(목)'),
    shoulder: idx('2축(어깨)'),
    pelvis: idx('3축(골반)'),
    lower: idx('4축(하체)'),
    mIncluded: idx('M포함'),
    uncertain: idx('미확정 축'),
    shortSummary: idx('간이 코드 설명'),
    guide: idx('회원가입 및 2차 문항 유도 멘트'),
  }

  const records = []
  for (let li = 1; li < lines.length; li++) {
    const cells = lines[li].split('\t')
    const code = cellStr(cells[col.code])
    if (!code) continue
    records.push({
      resultCode: code,
      neckResult: cellStr(cells[col.neck]),
      shoulderResult: cellStr(cells[col.shoulder]),
      pelvisResult: cellStr(cells[col.pelvis]),
      lowerBodyResult: cellStr(cells[col.lower]),
      hasUncertainAxis: parseYn(cells[col.mIncluded]),
      uncertainAxes: parseUncertainAxes(cells[col.uncertain]),
      shortSummary: cellStr(cells[col.shortSummary]),
      guideText: cellStr(cells[col.guide]),
    })
  }
  records.sort((a, b) => a.resultCode.localeCompare(b.resultCode))
  return records
}

function theoreticalCodes() {
  const out = new Set()
  for (const a of FCM) {
    for (const b of RLM) {
      for (const c of RLM) {
        for (const d of SFM) {
          out.add(`${a}${b}${c}${d}`)
        }
      }
    }
  }
  return out
}

function validate(records) {
  const theoretical = theoreticalCodes()
  const codes = new Set(records.map((r) => r.resultCode))
  const missing = [...theoretical].filter((c) => !codes.has(c)).sort()
  const extra = [...codes].filter((c) => !theoretical.has(c)).sort()
  const mrms = records.find((r) => r.resultCode === 'MRMS')
  return {
    count: records.length,
    unique_codes: codes.size,
    theoretical: theoretical.size,
    missing_codes: missing,
    extra_codes: extra,
    mrms_shortSummary_first_100: mrms?.shortSummary?.slice(0, 100) ?? '',
  }
}

const inputPath = resolve(projectRoot, process.argv[2] ?? 'sample-result-content.tsv')
const outputPath = resolve(projectRoot, process.argv[3] ?? 'src/data/sampleResultContent.json')

const tsv = readFileSync(inputPath, 'utf8')
const records = parseTsv(tsv)
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8')

const report = { ...validate(records), output: outputPath, output_exists: true }
console.log(JSON.stringify(report, null, 2))
