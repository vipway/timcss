import fs from 'node:fs/promises'
import path from 'node:path'
import type { TimcssConfig, TimcssScanResult } from '@timcss/core'
import { unique } from '@timcss/core'
import { htmlAdapter } from './adapters/html'
import { globPatternToRegExp, normalizePathSlashes } from './path-glob'
import { reactAdapter } from './adapters/react'
import { vueAdapter } from './adapters/vue'
import { wechatWxmlAdapter } from './adapters/wechat-wxml'

export interface TimcssScannerAdapter {
  name: string
  extensions: string[]
  extractCandidates(code: string): string[]
}

export const DEFAULT_ADAPTERS: TimcssScannerAdapter[] = [
  htmlAdapter,
  reactAdapter,
  vueAdapter,
  wechatWxmlAdapter,
]

export function matchesFilePatterns(
  file: string,
  patterns: string[],
  cwd = process.cwd(),
  exclude: string[] = [],
) {
  if (patterns.length === 0) return false
  let relative = normalizePathSlashes(path.relative(cwd, file))
  let includeRegexes = patterns.map(globPatternToRegExp)
  let excludeRegexes = exclude.map(globPatternToRegExp)
  if (excludeRegexes.some((regex) => regex.test(relative))) return false
  return includeRegexes.some((regex) => regex.test(relative))
}

async function walk(dir: string): Promise<string[]> {
  let entries = await fs.readdir(dir, { withFileTypes: true })
  let out: string[] = []
  for (let entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue
    let full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else out.push(full)
  }
  return out
}

export async function discoverFiles(patterns: string[], cwd = process.cwd(), exclude: string[] = []): Promise<string[]> {
  if (patterns.length === 0) return []
  let files = await walk(cwd)
  return files.filter((file) => matchesFilePatterns(file, patterns, cwd, exclude))
}

export async function scanFiles(
  files: string[],
  adapters: TimcssScannerAdapter[] = DEFAULT_ADAPTERS,
): Promise<TimcssScanResult> {
  let fileCandidates: Record<string, string[]> = {}
  let rawFileCandidates: Record<string, string[]> = {}
  for (let file of files) {
    let ext = path.extname(file)
    let adapter = adapters.find((candidate) => candidate.extensions.includes(ext))
    if (!adapter) continue
    let code = await fs.readFile(file, 'utf8')
    let extracted = adapter.extractCandidates(code)
    rawFileCandidates[file] = extracted
    fileCandidates[file] = unique(extracted)
  }

  return {
    filesScanned: files.length,
    fileCandidates,
    rawFileCandidates,
    candidates: unique(Object.values(fileCandidates).flat()),
  }
}

export async function scanFromConfig(
  config: TimcssConfig,
  adapters: TimcssScannerAdapter[] = DEFAULT_ADAPTERS,
): Promise<TimcssScanResult> {
  let cwd = config.cwd ?? process.cwd()
  let files = await discoverFiles(config.content ?? [], cwd, config.exclude ?? [])
  return scanFiles(files, adapters)
}

export { extractStaticContentRoot, globPatternToRegExp, normalizePathSlashes } from './path-glob'
