#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const gifDir = resolve(projectRoot, 'public/sample-media/gif')
const staticGifDir = resolve(projectRoot, '../src/main/resources/static/sample/sample-media/gif')
const downloadsDir = '/Users/wh.choi/Downloads/gif 파일 압축'

const SOURCES = {
  q02: [resolve(gifDir, 'q01.gif'), resolve(downloadsDir, '1-1.gif'), resolve(staticGifDir, 'q01.gif')],
  q03: [resolve(gifDir, 'q01.gif'), resolve(downloadsDir, '1-1.gif'), resolve(staticGifDir, 'q01.gif')],
}

mkdirSync(gifDir, { recursive: true })

for (const [key, candidates] of Object.entries(SOURCES)) {
  const dest = resolve(gifDir, `${key}.gif`)
  if (existsSync(dest)) {
    console.log(`skip ${key}.gif (already exists)`)
    continue
  }
  const src = candidates.find((path) => existsSync(path))
  if (!src) {
    console.error(`missing source for ${key}.gif`)
    process.exitCode = 1
    continue
  }
  copyFileSync(src, dest)
  console.log(`restored ${key}.gif <= ${src}`)
}
