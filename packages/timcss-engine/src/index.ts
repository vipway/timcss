import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  TimcssBuildArtifactKind,
  TimcssBuildArtifactSummary,
  TimcssBuildJsonPayload,
  TimcssCandidateCatalogMatch,
  TimcssCatalogItem,
  TimcssCatalogJsonPayload,
  TimcssCatalogPayload,
  TimcssCommandJsonEnvelope,
  TimcssConfig,
  TimcssDiagnostic,
  TimcssDiagnosticLevel,
  TimcssDoctorChecks,
  TimcssDoctorJsonPayload,
  TimcssDoctorReport,
  TimcssInspectJsonPayload,
  TimcssOutputMode,
  TimcssScanResult,
  TimcssVariantName,
} from '@timcss/core'
import { mergeConfig, unique } from '@timcss/core'
import { runDiagnostics } from '@timcss/diagnostics'
import {
  discoverFiles,
  extractStaticContentRoot,
  globPatternToRegExp,
  normalizePathSlashes,
  scanFiles,
  scanFromConfig,
} from '@timcss/scanner'
import { createMobileTokens, renderMobileThemeCss, type MobileThemeVariableName } from '@timcss/tokens'
import { createMobileVariantsCss } from '@timcss/variants'
import { expandTimcssIntentTerms, includesTimcssTerm, normalizeTimcssIntentQuery } from '../../timcss-core/src/search'
import { createMobilePresetCss, MOBILE_PRESET_RULES } from '../../timcss-preset-mobile/src/index'
import { createWechatPresetCss, WECHAT_PRESET_RULES } from '../../timcss-preset-wechat/src/index'

const nodeRequire = createRequire(import.meta.url)
const catalogFileCache = new Map<string, string | null>()
const workspaceRootCache = new Map<string, string | null>()
const packageStylesheetPathCache = new Map<string, string | null>()
const stylesheetContentCache = new Map<string, string>()
const mobileTokenReplacementCache = new Map<string, Map<string, string>>()
let tailwindCompilePromise: Promise<(typeof import('tailwindcss'))['compile']> | null = null
const CSS_NO_SPACE_PUNCTUATION = new Set(['{', '}', ':', ';', ',', '>', '(', ')'])
const TIMCSS_VARIANT_NAMES: TimcssVariantName[] = [
  'pressed',
  'disabled',
  'safe',
  'notch',
  'tabbar-present',
  'keyboard-open',
]
const TIMCSS_MOBILE_PRESET_CLASSES = new Set([
  'px-page',
  'py-section',
  'p-card',
  'gap-section',
  'gap-card',
  'h-nav',
  'h-tabbar',
  'h-control-xs',
  'h-control-sm',
  'h-control',
  'h-control-lg',
  'h-control-xl',
  'min-h-touch',
  'rounded-card',
  'rounded-control',
  'bg-primary',
  'bg-surface',
  'bg-background',
  'text-primary',
  'text-muted',
  'text-on-primary',
  'border-default',
  'shadow-card',
  'shadow-elevated',
])
const TIMCSS_WECHAT_PRESET_CLASSES = new Set([
  'pt-safe',
  'pr-safe',
  'pb-safe',
  'pl-safe',
  'px-safe',
  'py-safe',
  'pb-tabbar-safe',
  'pt-nav-safe',
  'hairline',
  'hairline-t',
  'hairline-r',
  'hairline-b',
  'hairline-l',
])
const TIMCSS_MOBILE_PRESET_TOKEN_MAP: Record<string, MobileThemeVariableName[]> = {
  'px-page': ['--layout-page'],
  'py-section': ['--layout-section'],
  'p-card': ['--layout-card'],
  'gap-section': ['--layout-section'],
  'gap-card': ['--layout-card'],
  'h-nav': ['--layout-nav'],
  'h-tabbar': ['--layout-tabbar'],
  'h-control-xs': ['--control-xs'],
  'h-control-sm': ['--control-sm'],
  'h-control': ['--control-md'],
  'h-control-lg': ['--control-lg'],
  'h-control-xl': ['--control-xl'],
  'min-h-touch': ['--layout-touch'],
  'rounded-card': ['--radius-lg'],
  'rounded-control': ['--radius-md'],
  'bg-primary': ['--color-primary'],
  'bg-surface': ['--color-surface'],
  'bg-background': ['--color-background'],
  'text-primary': ['--color-text'],
  'text-muted': ['--color-muted'],
  'text-on-primary': ['--color-on-primary'],
  'border-default': ['--color-border'],
  'shadow-card': ['--shadow-card'],
  'shadow-elevated': ['--shadow-elevated'],
}
const TIMCSS_WECHAT_PRESET_TOKEN_MAP: Record<string, MobileThemeVariableName[]> = {
  'pb-tabbar-safe': ['--layout-tabbar'],
  'pt-nav-safe': ['--layout-nav'],
  hairline: ['--color-border'],
  'hairline-t': ['--color-border'],
  'hairline-r': ['--color-border'],
  'hairline-b': ['--color-border'],
  'hairline-l': ['--color-border'],
}

function catalogSummary(catalog: TimcssCatalogPayload | null) {
  return catalog
    ? {
        schemaVersion: catalog.schemaVersion,
        generatedAt: catalog.generatedAt,
        packageVersion: catalog.packageVersion,
      }
    : null
}

function createJsonEnvelope<TCommand extends string, TPayload>(
  command: TCommand,
  payload: TPayload,
): TimcssCommandJsonEnvelope<TCommand, TPayload> {
  return {
    tool: 'timcss',
    command,
    schemaVersion: '1',
    generatedAt: new Date().toISOString(),
    payload,
  }
}

export const DEFAULT_CONFIG: TimcssConfig = {
  platform: 'mobile',
  density: 'comfortable',
  diagnostics: { enabled: true, level: 'info', output: 'pretty' },
  variants: { enabled: true },
  presets: {
    mobile: { enabled: true, includeControls: true, includeLayouts: true, includeSemanticColors: true },
    wechat: { enabled: true },
    recipes: { enabled: false },
  },
}

async function fileExists(file: string) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function findTimcssCatalogFile(cwd = process.cwd()) {
  let resolvedCwd = path.resolve(cwd)
  let cached = catalogFileCache.get(resolvedCwd)
  if (cached !== undefined) return cached

  let current = resolvedCwd
  while (true) {
    let candidates = [
      path.resolve(current, 'docs', 'atomic-utilities-index.json'),
    ]
    for (let file of candidates) {
      if (await fileExists(file)) {
        catalogFileCache.set(resolvedCwd, file)
        return file
      }
    }

    let parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  catalogFileCache.set(resolvedCwd, null)
  return null
}

async function findTimcssWorkspaceRoot(cwd = process.cwd()) {
  let resolvedCwd = path.resolve(cwd)
  let cached = workspaceRootCache.get(resolvedCwd)
  if (cached !== undefined) return cached

  let current = resolvedCwd
  while (true) {
    let packageJsonPath = path.resolve(current, 'package.json')
    if (await fileExists(packageJsonPath)) {
      let hasPackages = await fileExists(path.resolve(current, 'packages', 'timcss-core', 'package.json'))
      let hasDocs = await fileExists(path.resolve(current, 'docs'))
      let hasExamples = await fileExists(path.resolve(current, 'examples'))
      if (hasPackages && hasDocs && hasExamples) {
        workspaceRootCache.set(resolvedCwd, current)
        return current
      }
    }

    let parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  workspaceRootCache.set(resolvedCwd, null)
  return null
}

function isValidTimcssPrefix(prefix: string) {
  return /^[a-z]+$/.test(prefix)
}

export async function loadTimcssCatalog(cwd = process.cwd()): Promise<TimcssCatalogPayload | null> {
  let file = await findTimcssCatalogFile(cwd)
  if (!file) return null
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function removeCandidatePrefix(value: string, prefix?: string) {
  if (!prefix) return value
  let withDash = `${prefix}-`
  return value.startsWith(withDash) ? value.slice(withDash.length) : value
}

function matchesCatalogClassName(item: TimcssCatalogItem, candidate: string) {
  if (item.className === candidate) return true
  if (!item.modifiers?.length) return false
  return candidate.startsWith(`${item.className}/`) && item.modifiers.includes(candidate.slice(item.className.length + 1))
}

function resolveCatalogMatchesForCandidate(
  candidate: string,
  byClass: Map<string, TimcssCatalogItem>,
  itemsWithModifiers: TimcssCatalogItem[],
) {
  let parts = candidate.split(':')
  let resolved: TimcssCatalogItem[] = []

  if (byClass.has(candidate)) resolved.push(byClass.get(candidate)!)
  for (let item of itemsWithModifiers) {
    if (matchesCatalogClassName(item, candidate)) resolved.push(item)
  }

  if (parts.length > 1) {
    for (let i = 0; i < parts.length - 1; i++) {
      let variantName = `${parts[i]}:`
      if (byClass.has(variantName)) resolved.push(byClass.get(variantName)!)
    }
    let utilityName = parts[parts.length - 1]
    if (byClass.has(utilityName)) resolved.push(byClass.get(utilityName)!)
    for (let item of itemsWithModifiers) {
      if (matchesCatalogClassName(item, utilityName)) resolved.push(item)
    }
  }

  return resolved
}

function resolveCandidateCatalogMatches(
  candidates: string[],
  items: TimcssCatalogItem[],
  prefix?: string,
): TimcssCandidateCatalogMatch[] {
  let byClass = new Map(items.map((item) => [item.className, item]))
  let itemsWithModifiers = items.filter((item) => item.modifiers?.length)
  let matches: TimcssCandidateCatalogMatch[] = []

  for (let candidate of candidates) {
    let resolved: TimcssCatalogItem[] = []
    resolved.push(...resolveCatalogMatchesForCandidate(candidate, byClass, itemsWithModifiers))

    let normalized = candidate
      .split(':')
      .filter(Boolean)
      .map((segment) => removeCandidatePrefix(segment, prefix))
      .join(':')
    if (normalized !== candidate) {
      resolved.push(...resolveCatalogMatchesForCandidate(normalized, byClass, itemsWithModifiers))
    }

    let seen = new Set<string>()
    let uniqueResolved = resolved.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })

    if (uniqueResolved.length > 0) matches.push({ candidate, matches: uniqueResolved })
  }

  return matches
}

function toKnownTimcssSets(catalog: TimcssCatalogPayload | null) {
  if (!catalog) return { knownUtilities: undefined, knownVariants: undefined }
  let knownUtilities = new Set(
    catalog.items.filter((item) => item.kind === 'utility').map((item) => item.className),
  )
  let knownVariants = new Set(
    catalog.items
      .filter((item) => item.kind === 'variant')
      .map((item) => item.className.replace(/:$/, '')),
  )
  return { knownUtilities, knownVariants }
}

export function filterCatalogItems(
  items: TimcssCatalogItem[],
  options: {
    className?: string
    platform?: string
    status?: string
    kind?: string
    query?: string
    intent?: string
    sourcePackage?: string
  } = {},
) {
  function scoreIntent(item: TimcssCatalogItem, phrase: string, terms: string[]) {
    const className = item.className.toLowerCase()
    const intent = item.intent.toLowerCase()
    const whenToUse = item.whenToUse.toLowerCase()
    const category = item.category.toLowerCase()
    const output = item.output.toLowerCase()
    let score = 0

    if (phrase && includesTimcssTerm(intent, phrase)) score += 90
    if (phrase && includesTimcssTerm(whenToUse, phrase)) score += 70
    if (phrase && includesTimcssTerm(className, phrase)) score += 60

    for (const term of terms) {
      if (includesTimcssTerm(className, term)) score += 40
      if (includesTimcssTerm(intent, term)) score += 36
      if (includesTimcssTerm(whenToUse, term)) score += 28
      if (includesTimcssTerm(category, term)) score += 18
      if (includesTimcssTerm(output, term)) score += 12
    }

    return score
  }

  let query = options.query?.toLowerCase().trim()
  let filtered = items.filter((item) => {
    if (options.className && !matchesCatalogClassName(item, options.className)) return false
    if (options.platform && !item.platforms.includes(options.platform as any)) return false
    if (options.status && item.status !== options.status) return false
    if (options.kind && item.kind !== options.kind) return false
    if (options.sourcePackage && item.sourcePackage !== options.sourcePackage) return false
    if (
      query &&
      ![
        item.className,
        item.id,
        item.intent,
        item.output,
        item.whenToUse,
        item.category,
        item.sourcePackage,
        ...(item.modifiers ?? []),
        ...item.platforms,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    ) {
      return false
    }
    return true
  })

  let intent = options.intent ? normalizeTimcssIntentQuery(options.intent) : ''
  if (!intent) return filtered

  let intentTerms = expandTimcssIntentTerms(intent)
  let scored = filtered
    .map((item) => ({ item, score: scoreIntent(item, intent, intentTerms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      return a.item.className.localeCompare(b.item.className)
    })

  return scored.map((entry) => entry.item)
}

function filterDiagnosticsByLevel(diagnostics: TimcssDiagnostic[], level: TimcssDiagnosticLevel | undefined) {
  let order: Record<TimcssDiagnosticLevel, number> = { info: 0, warning: 1, error: 2 }
  let min = order[(level ?? 'info') as keyof typeof order]
  return diagnostics.filter((item) => order[item.level] >= min)
}

export async function loadTimcssConfig(explicitPath?: string, cwd = process.cwd()): Promise<TimcssConfig> {
  let candidates = explicitPath
    ? [path.resolve(cwd, explicitPath)]
    : [path.resolve(cwd, 'timcss.config.json'), path.resolve(cwd, 'timcss.config.mjs'), path.resolve(cwd, 'timcss.config.js')]

  for (let file of candidates) {
    if (!(await fileExists(file))) continue
    let loadedConfig: TimcssConfig
    if (file.endsWith('.json')) loadedConfig = JSON.parse(await fs.readFile(file, 'utf8'))
    else {
      let loaded = await import(pathToFileURL(file).href)
      loadedConfig = loaded.default ?? loaded
    }
    let merged = mergeConfig(DEFAULT_CONFIG, loadedConfig)
    return { ...merged, cwd: merged.cwd ?? path.dirname(file) }
  }

  return { ...DEFAULT_CONFIG, cwd }
}

type TimcssBuildSelection = {
  mobileUtilities?: string[]
  wechatUtilities?: string[]
  variants?: string[]
  themeVariables?: MobileThemeVariableName[]
  includeUtilityDefinitions?: boolean
  directUtilityCss?: string
}

type TimcssResolvedEntryGroup = {
  entryName: string
  sourcePatterns: string[]
  files: string[]
  candidates: string[]
  outputFile: string
}

type TimcssEntryBuildPlan = {
  entries: TimcssResolvedEntryGroup[]
  matchedFiles: string[]
  unmatchedFiles: string[]
  overlappingFiles: Record<string, string[]>
  candidates: string[]
}

type TimcssBuildBaseResult = {
  css: string
  sourcemap: string | null
  minified: boolean
  diagnostics: TimcssDiagnostic[]
  catalog: TimcssCatalogPayload | null
  candidateMatches: TimcssCandidateCatalogMatch[]
  entry: string
  candidates: string[]
}

export type TimcssBuiltArtifact = TimcssBuildArtifactSummary & {
  css: string
  sourcemap: string | null
  minified: boolean
}

export type TimcssBuildResult = TimcssBuildBaseResult & {
  files?: string[]
  filesScanned?: number
  fileCandidates?: Record<string, string[]>
  artifacts?: TimcssBuiltArtifact[]
}

function resolveOutputMode(config: TimcssConfig): TimcssOutputMode {
  return config.output?.mode === 'per-entry' || (config.output?.entries?.length ?? 0) > 0 ? 'per-entry' : 'single'
}

function resolveFileBuildOutputMode(config: TimcssConfig, filesScanned: number): TimcssOutputMode {
  if (config.output?.mode === 'single') return 'single'
  if (config.output?.mode === 'per-entry') return 'per-entry'
  if ((config.output?.entries?.length ?? 0) > 0) return 'per-entry'
  if (config.output?.file) return 'single'
  if (config.output?.dir) return 'per-entry'
  if (config.platform === 'wechat-miniprogram' && filesScanned > 0) return 'per-entry'
  return 'single'
}

function resolveCommonAncestor(paths: string[]) {
  if (paths.length === 0) return null
  let ancestor = path.resolve(paths[0])
  for (let candidate of paths.slice(1)) {
    let absolute = path.resolve(candidate)
    while (true) {
      let relative = path.relative(ancestor, absolute)
      if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) break
      let parent = path.dirname(ancestor)
      if (parent === ancestor) return ancestor
      ancestor = parent
    }
  }
  return ancestor
}

function resolveContentRoot(config: TimcssConfig) {
  let cwd = config.cwd ?? process.cwd()
  let roots = (config.content ?? []).map(extractStaticContentRoot).map((entry) => path.resolve(cwd, entry))
  return resolveCommonAncestor(roots) ?? cwd
}

function replaceOutputExtension(file: string, extension = '.css') {
  let normalized = normalizePathSlashes(file)
  let replaced = normalized.replace(/\.[^/.]+$/, '')
  return replaced === normalized ? `${normalized}${extension}` : `${replaced}${extension}`
}

function resolveSplitOutputExtension(config: TimcssConfig) {
  return config.platform === 'wechat-miniprogram' ? '.wxss' : '.css'
}

function resolvePerEntryOutputDir(config: TimcssConfig) {
  return path.resolve(config.cwd ?? process.cwd(), config.output?.dir ?? 'dist')
}

function resolveSharedOutputFile(config: TimcssConfig) {
  let configured = config.output?.sharedFile ?? (config.platform === 'wechat-miniprogram' ? 'app.wxss' : 'shared.css')
  return path.isAbsolute(configured) ? configured : path.resolve(resolvePerEntryOutputDir(config), configured)
}

function resolveEntryOutputFile(config: TimcssConfig, sourceFile: string) {
  let cwd = config.cwd ?? process.cwd()
  let contentRoot = resolveContentRoot(config)
  let relativeFromRoot = normalizePathSlashes(path.relative(contentRoot, sourceFile))
  let relativeFromCwd = normalizePathSlashes(path.relative(cwd, sourceFile))
  let relativePath = relativeFromRoot.startsWith('..') ? relativeFromCwd : relativeFromRoot
  if (!relativePath || relativePath.startsWith('..')) relativePath = path.basename(sourceFile)
  return path.resolve(resolvePerEntryOutputDir(config), replaceOutputExtension(relativePath, resolveSplitOutputExtension(config)))
}

function resolveConfiguredEntryOutputFile(config: TimcssConfig, outputFile: string) {
  let normalized = path.extname(outputFile) ? outputFile : replaceOutputExtension(outputFile, resolveSplitOutputExtension(config))
  if (path.isAbsolute(normalized)) return normalized
  let baseDir = config.output?.dir ? resolvePerEntryOutputDir(config) : path.resolve(config.cwd ?? process.cwd())
  return path.resolve(baseDir, normalized)
}

function createRelativeImportPath(fromFile: string, toFile: string) {
  let relative = normalizePathSlashes(path.relative(path.dirname(fromFile), toFile))
  return relative.startsWith('.') ? relative : `./${relative}`
}

function partitionEntryCandidates(
  fileCandidates: Record<string, string[]>,
  orderedCandidates: string[],
  minUsage = 2,
) {
  let usageCount = new Map<string, number>()
  for (let candidates of Object.values(fileCandidates)) {
    for (let candidate of unique(candidates)) {
      usageCount.set(candidate, (usageCount.get(candidate) ?? 0) + 1)
    }
  }

  let threshold = Math.max(2, minUsage)
  let sharedSet = new Set(orderedCandidates.filter((candidate) => (usageCount.get(candidate) ?? 0) >= threshold))
  let entryCandidates = Object.fromEntries(
    Object.entries(fileCandidates).map(([file, candidates]) => [file, candidates.filter((candidate) => !sharedSet.has(candidate))]),
  )

  return {
    sharedCandidates: orderedCandidates.filter((candidate) => sharedSet.has(candidate)),
    entryCandidates,
  }
}

function createBuildArtifactSummary(
  kind: TimcssBuildArtifactKind,
  css: string,
  candidates: string[],
  sourceFile: string | null,
  outputFile: string | null,
  options: { entryName?: string | null; sourcePatterns?: string[] | null } = {},
): TimcssBuildArtifactSummary {
  return {
    kind,
    sourceFile,
    entryName: options.entryName ?? null,
    sourcePatterns: options.sourcePatterns ?? null,
    outputFile,
    cssBytes: Buffer.byteLength(css, 'utf8'),
    candidateCount: candidates.length,
    candidates,
  }
}

function createSingleBuiltArtifact(result: TimcssBuildBaseResult, config: TimcssConfig = {}): TimcssBuiltArtifact {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  return {
    ...createBuildArtifactSummary('single', result.css, result.candidates, null, resolved.output?.file ?? null),
    css: result.css,
    sourcemap: result.sourcemap,
    minified: result.minified,
  }
}

export function getTimcssBuildArtifacts(result: TimcssBuildResult, config: TimcssConfig = {}): TimcssBuiltArtifact[] {
  if (result.artifacts?.length) return result.artifacts
  return [createSingleBuiltArtifact(result, config)]
}

function resolveConfiguredEntryPlan(
  fileCandidates: Record<string, string[]>,
  orderedCandidates: string[],
  config: TimcssConfig,
): TimcssEntryBuildPlan | null {
  let configuredEntries = config.output?.entries
  if (!configuredEntries?.length) return null

  let cwd = config.cwd ?? process.cwd()
  let files = Object.keys(fileCandidates)
  let relativeFileMap = new Map(files.map((file) => [file, normalizePathSlashes(path.relative(cwd, file))]))
  let matchedFiles = new Set<string>()
  let overlappingFiles = new Map<string, string[]>()

  let entries = configuredEntries.map((entry, index) => {
    let includeRegexes = entry.include.map(globPatternToRegExp)
    let excludeRegexes = [...(config.exclude ?? []), ...(entry.exclude ?? [])].map(globPatternToRegExp)
    let entryName = entry.name?.trim() || `entry-${index + 1}`
    let entryFiles = files.filter((file) => {
      let relative = relativeFileMap.get(file) ?? normalizePathSlashes(path.relative(cwd, file))
      if (excludeRegexes.some((regex) => regex.test(relative))) return false
      return includeRegexes.some((regex) => regex.test(relative))
    })

    for (let file of entryFiles) {
      matchedFiles.add(file)
      let owners = overlappingFiles.get(file) ?? []
      owners.push(entryName)
      overlappingFiles.set(file, owners)
    }

    let candidateSet = new Set(entryFiles.flatMap((file) => fileCandidates[file] ?? []))
    return {
      entryName,
      sourcePatterns: entry.include,
      files: entryFiles,
      candidates: orderedCandidates.filter((candidate) => candidateSet.has(candidate)),
      outputFile: resolveConfiguredEntryOutputFile(config, entry.outputFile),
    }
  })

  let overlappingAssignments = Object.fromEntries(
    [...overlappingFiles.entries()].filter(([, owners]) => owners.length > 1).map(([file, owners]) => [file, owners]),
  )
  let matchedCandidateSet = new Set(entries.flatMap((entry) => entry.candidates))

  return {
    entries,
    matchedFiles: files.filter((file) => matchedFiles.has(file)),
    unmatchedFiles: files.filter((file) => !matchedFiles.has(file)),
    overlappingFiles: overlappingAssignments,
    candidates: orderedCandidates.filter((candidate) => matchedCandidateSet.has(candidate)),
  }
}

function createBuildSelection(candidates: string[], prefix?: string): TimcssBuildSelection {
  let mobileUtilities = new Set<string>()
  let wechatUtilities = new Set<string>()
  let variants = new Set<string>()

  for (let candidate of candidates) {
    let parts = candidate.split(':').filter(Boolean)
    if (parts.length === 0) continue

    for (let index = 0; index < parts.length - 1; index++) {
      variants.add(removeCandidatePrefix(parts[index], prefix))
    }

    let utility = removeCandidatePrefix(parts[parts.length - 1], prefix)
    if (TIMCSS_MOBILE_PRESET_CLASSES.has(utility)) {
      mobileUtilities.add(utility)
    }
    if (TIMCSS_WECHAT_PRESET_CLASSES.has(utility)) {
      wechatUtilities.add(utility)
    }
  }

  return {
    mobileUtilities: [...mobileUtilities],
    wechatUtilities: [...wechatUtilities],
    variants: [...variants],
  }
}

function createThemeVariableSelection(selection: TimcssBuildSelection) {
  if (selection.themeVariables) return selection.themeVariables
  let variables = new Set<MobileThemeVariableName>()

  for (let utility of selection.mobileUtilities ?? []) {
    for (let variable of TIMCSS_MOBILE_PRESET_TOKEN_MAP[utility] ?? []) variables.add(variable)
  }

  for (let utility of selection.wechatUtilities ?? []) {
    for (let variable of TIMCSS_WECHAT_PRESET_TOKEN_MAP[utility] ?? []) variables.add(variable)
  }

  return [...variables]
}

function renderResolvedThemeLayerCss(
  density = DEFAULT_CONFIG.density,
  overrides: NonNullable<TimcssConfig['theme']>['overrides'] = {},
  includeVariables?: MobileThemeVariableName[],
) {
  let tokens = createMobileTokens(density ?? 'comfortable', overrides ?? {})
  let include = includeVariables ? new Set(includeVariables) : null
  let declarations: string[] = []
  let push = (variable: MobileThemeVariableName, value: string) => {
    if (!include || include.has(variable)) declarations.push(`    ${variable}: ${value};`)
  }

  push('--spacing', tokens.spacing)
  for (let [k, v] of Object.entries(tokens.fontSize)) push(`--text-${k}`, v)
  for (let [k, v] of Object.entries(tokens.lineHeight)) push(`--text-${k}--line-height`, v)
  for (let [k, v] of Object.entries(tokens.radius)) push(`--radius${k === 'DEFAULT' ? '' : `-${k}`}`, v)
  for (let [k, v] of Object.entries(tokens.controlHeight)) push(`--control-${k}`, v)
  for (let [k, v] of Object.entries(tokens.layout)) push(`--layout-${k}`, v)
  for (let [k, v] of Object.entries(tokens.colors)) push(`--color-${k}`, v)
  for (let [k, v] of Object.entries(tokens.shadows)) push(`--shadow-${k}`, v)

  if (declarations.length === 0) return ''
  return ['@layer theme {', '  :root, :host {', ...declarations, '  }', '}'].join('\n')
}

function renderDirectUtilityCss(
  candidates: string[],
  config: TimcssConfig,
  options: { includeMobile?: boolean; includeWechat?: boolean } = {},
) {
  let prefix = config.prefix ? `${config.prefix}-` : ''
  let mobileRules = options.includeMobile === false ? [] : MOBILE_PRESET_RULES
  let wechatRules = options.includeWechat === false ? [] : WECHAT_PRESET_RULES
  let byUtility = new Map<string, string>([...mobileRules, ...wechatRules].map((rule) => [rule.className, rule.body]))
  let selectors = unique(candidates)
    .map((candidate) => {
      if (candidate.includes(':')) return null
      let utility = removeCandidatePrefix(candidate, config.prefix)
      let body = byUtility.get(utility)
      if (!body) return null
      let className = prefix ? `${prefix}${utility}` : utility
      return `  .${className} {\n    ${body}\n  }`
    })
    .filter((item): item is string => !!item)

  if (selectors.length === 0) return ''
  return `@layer utilities {\n${selectors.join('\n\n')}\n}`
}

function splitDirectUtilityCandidates(candidates: string[], config: TimcssConfig) {
  let mobileEnabled = config.presets?.mobile?.enabled !== false
  let wechatEnabled = config.platform === 'wechat-miniprogram' && config.presets?.wechat?.enabled !== false
  let direct = new Set<string>()
  let mobileRules = mobileEnabled ? TIMCSS_MOBILE_PRESET_CLASSES : new Set<string>()
  let wechatRules = wechatEnabled ? TIMCSS_WECHAT_PRESET_CLASSES : new Set<string>()

  for (let candidate of unique(candidates)) {
    if (candidate.includes(':')) continue
    let utility = removeCandidatePrefix(candidate, config.prefix)
    if (mobileRules.has(utility) || wechatRules.has(utility)) direct.add(candidate)
  }

  return {
    direct: [...direct],
    compile: candidates.filter((candidate) => !direct.has(candidate)),
  }
}

export function createTimcssCssEntry(config: TimcssConfig = {}, selection: TimcssBuildSelection = {}): string {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  let prefix = resolved.prefix
  let includePreflight = resolved.preflight ?? resolved.platform !== 'wechat-miniprogram'
  let inlineThemeTokens = resolved.inlineThemeTokens ?? resolved.platform === 'wechat-miniprogram'
  let selectionActive =
    selection.mobileUtilities !== undefined || selection.wechatUtilities !== undefined || selection.variants !== undefined
  let needsThemeVariables =
    !selectionActive || (selection.mobileUtilities?.length ?? 0) > 0 || (selection.wechatUtilities?.length ?? 0) > 0
  let selectedVariants =
    selection.variants?.filter((name): name is TimcssVariantName => TIMCSS_VARIANT_NAMES.includes(name as TimcssVariantName)) ??
    undefined
  let variantsEnabled = selection.variants !== undefined ? (selectedVariants?.length ?? 0) > 0 : resolved.variants?.enabled
  let includeThemeTokens = needsThemeVariables && (!selectionActive || !inlineThemeTokens)
  let includeUtilityDefinitions = selection.includeUtilityDefinitions ?? true
  let themeCss = includeThemeTokens && !selectionActive ? renderMobileThemeCss(resolved.density, resolved.theme?.overrides) : ''
  let parts = [
    '@layer theme, base, components, utilities;',
    `@import 'tailwindcss/theme.css' layer(theme);`,
    includePreflight ? `@import 'tailwindcss/preflight.css' layer(base);` : '',
    themeCss,
    createMobileVariantsCss({
      ...(resolved.variants ?? {}),
      enabled: variantsEnabled,
      prefix: resolved.variants?.prefix ?? prefix,
      include: selectedVariants ?? resolved.variants?.include,
    }),
    resolved.presets?.mobile?.enabled === false
      ? ''
      : createMobilePresetCss({
          prefix,
          includeControls: resolved.presets?.mobile?.includeControls,
          includeLayouts: resolved.presets?.mobile?.includeLayouts,
          includeSemanticColors: resolved.presets?.mobile?.includeSemanticColors,
          includeClasses: includeUtilityDefinitions ? selection.mobileUtilities : [],
        }),
    resolved.platform === 'wechat-miniprogram' && resolved.presets?.wechat?.enabled !== false
      ? createWechatPresetCss({
          prefix,
          includeClasses: includeUtilityDefinitions ? selection.wechatUtilities : [],
        })
      : '',
    selection.directUtilityCss ?? '',
    `@import 'tailwindcss/utilities.css' layer(utilities);`,
  ]
  return parts.filter(Boolean).join('\n\n')
}

async function loadTailwindCompile() {
  if (!tailwindCompilePromise) {
    tailwindCompilePromise = import('tailwindcss').then((module) => module.compile)
  }
  return tailwindCompilePromise
}

export async function createTimcssCompiler(
  config: TimcssConfig = {},
  candidates: string[] = [],
  selection: TimcssBuildSelection = createBuildSelection(candidates, config.prefix),
) {
  let entry = createTimcssCssEntry(config, selection)
  let compile = await loadTailwindCompile()
  return compile(entry, {
    base: process.cwd(),
    async loadStylesheet(id, base) {
      let resolvedPath: string | null = null
      if (path.isAbsolute(id) || id.startsWith('.')) {
        let fromBase = path.resolve(base, id)
        if (await fileExists(fromBase)) resolvedPath = fromBase
        else {
          let fromCwd = path.resolve(process.cwd(), id)
          if (await fileExists(fromCwd)) resolvedPath = fromCwd
        }
      } else {
        resolvedPath = await resolvePackageStylesheet(id)
      }

      if (!resolvedPath) {
        throw new Error(`Unable to resolve stylesheet import: ${id}`)
      }
      let cachedContent = stylesheetContentCache.get(resolvedPath)
      if (cachedContent !== undefined) {
        return {
          path: resolvedPath,
          base: path.dirname(resolvedPath),
          content: cachedContent,
        }
      }
      let content = await fs.readFile(resolvedPath, 'utf8')
      stylesheetContentCache.set(resolvedPath, content)
      return {
        path: resolvedPath,
        base: path.dirname(resolvedPath),
        content,
      }
    },
  })
}

async function resolvePackageStylesheet(id: string) {
  let cached = packageStylesheetPathCache.get(id)
  if (cached !== undefined) return cached
  try {
    let resolved = nodeRequire.resolve(id)
    packageStylesheetPathCache.set(id, resolved)
    return resolved
  } catch {
    packageStylesheetPathCache.set(id, null)
    return null
  }
}

async function enrichWithCatalog(
  candidates: string[],
  diagnostics: TimcssDiagnostic[],
  cwd = process.cwd(),
  catalog: TimcssCatalogPayload | null | undefined = undefined,
  prefix?: string,
) {
  let resolvedCatalog = catalog === undefined ? await loadTimcssCatalog(cwd) : catalog
  let candidateMatches = resolvedCatalog ? resolveCandidateCatalogMatches(candidates, resolvedCatalog.items, prefix) : []
  let matchMap = new Map(candidateMatches.map((item) => [item.candidate, item.matches]))
  let diagnosticsWithCatalog = diagnostics.map((item) => ({
    ...item,
    catalogMatches: item.className ? matchMap.get(item.className) ?? [] : [],
  }))
  return { catalog: resolvedCatalog, candidateMatches, diagnostics: diagnosticsWithCatalog }
}

export async function buildTimcssFromCandidates(
  candidates: string[],
  config: TimcssConfig = {},
  options: {
    catalog?: TimcssCatalogPayload | null
    extraDiagnostics?: TimcssDiagnostic[]
    includeCatalogData?: boolean
    includeDiagnostics?: boolean
  } = {},
): Promise<TimcssBuildResult> {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  let selection = createBuildSelection(candidates, resolved.prefix)
  let split = splitDirectUtilityCandidates(candidates, resolved)
  let compileSelection = createBuildSelection(split.compile, resolved.prefix)
  let compilerSelection: TimcssBuildSelection = {
    mobileUtilities: compileSelection.mobileUtilities,
    wechatUtilities: compileSelection.wechatUtilities,
    variants: compileSelection.variants,
    themeVariables: createThemeVariableSelection(selection),
    directUtilityCss: renderDirectUtilityCss(split.direct, resolved, {
      includeMobile: resolved.presets?.mobile?.enabled !== false,
      includeWechat: resolved.platform === 'wechat-miniprogram' && resolved.presets?.wechat?.enabled !== false,
    }),
  }
  let compiler = await createTimcssCompiler(resolved, split.compile, compilerSelection)
  let includeCatalogData = options.includeCatalogData !== false
  let includeDiagnostics = options.includeDiagnostics !== false
  let shouldLoadCatalog = includeCatalogData || includeDiagnostics
  let catalog = shouldLoadCatalog
    ? options.catalog === undefined
      ? await loadTimcssCatalog(resolved.cwd ?? process.cwd())
      : options.catalog
    : null
  let known = includeDiagnostics ? toKnownTimcssSets(catalog) : { knownUtilities: undefined, knownVariants: undefined }
  let diagnosticsInput =
    !includeDiagnostics || resolved.diagnostics?.enabled === false
      ? []
      : runDiagnostics(candidates, resolved.platform, {
          ...known,
          prefix: resolved.prefix,
        })
  let rawDiagnostics = includeDiagnostics ? [...diagnosticsInput, ...(options.extraDiagnostics ?? [])] : []
  let diagnostics = includeDiagnostics ? filterDiagnosticsByLevel(rawDiagnostics, resolved.diagnostics?.level) : []
  let catalogData = includeCatalogData
    ? await enrichWithCatalog(unique(candidates), diagnostics, resolved.cwd ?? process.cwd(), catalog, resolved.prefix)
    : {
        catalog,
        candidateMatches: [] as TimcssCandidateCatalogMatch[],
        diagnostics,
      }
  let shouldInlineThemeTokens = resolved.inlineThemeTokens ?? resolved.platform === 'wechat-miniprogram'
  let manualThemeCss = shouldInlineThemeTokens
    ? ''
    : renderResolvedThemeLayerCss(resolved.density, resolved.theme?.overrides, compilerSelection.themeVariables)
  let builtCss = compiler.build(split.compile)
  let transformed = transformBuildCssOutput(
    manualThemeCss ? `${manualThemeCss}\n\n${builtCss}` : builtCss,
    resolved,
    candidates,
  )
  return {
    css: transformed.css,
    sourcemap: transformed.sourcemap,
    minified: transformed.minified,
    diagnostics: catalogData.diagnostics,
    catalog: catalogData.catalog,
    candidateMatches: catalogData.candidateMatches,
    entry: createTimcssCssEntry(resolved, compilerSelection),
    candidates,
  }
}

async function buildSplitArtifact(
  kind: TimcssBuildArtifactKind,
  candidates: string[],
  config: TimcssConfig,
  options: {
    sourceFile?: string
    outputFile?: string
    forceBuild?: boolean
    entryName?: string
    sourcePatterns?: string[]
  } = {},
): Promise<TimcssBuiltArtifact> {
  let outputFile = options.outputFile ?? null
  let minified = config.output?.minify ?? (config.platform === 'wechat-miniprogram' && !!outputFile)
  if (candidates.length === 0 && options.forceBuild !== true) {
    let css = ''
    return {
      ...createBuildArtifactSummary(kind, css, [], options.sourceFile ?? null, outputFile, {
        entryName: options.entryName,
        sourcePatterns: options.sourcePatterns,
      }),
      css,
      sourcemap: null,
      minified,
    }
  }

  let buildConfig = mergeConfig(config, {
    output: outputFile ? { ...(config.output ?? {}), file: outputFile } : config.output,
  })
  let built = await buildTimcssFromCandidates(candidates, buildConfig, {
    includeCatalogData: false,
    includeDiagnostics: false,
  })

  return {
    ...createBuildArtifactSummary(kind, built.css, candidates, options.sourceFile ?? null, outputFile, {
      entryName: options.entryName,
      sourcePatterns: options.sourcePatterns,
    }),
    css: built.css,
    sourcemap: built.sourcemap,
    minified: built.minified,
  }
}

function injectSharedWechatImport(config: TimcssConfig, sharedArtifact: TimcssBuiltArtifact | undefined, entryArtifacts: TimcssBuiltArtifact[]) {
  if (
    config.platform !== 'wechat-miniprogram' ||
    !sharedArtifact?.outputFile ||
    sharedArtifact.css.trim().length === 0
  ) {
    return
  }

  for (let entryArtifact of entryArtifacts) {
    if (!entryArtifact.outputFile) continue
    let importPath = createRelativeImportPath(entryArtifact.outputFile, sharedArtifact.outputFile)
    let importLine = `@import "${importPath}";`
    entryArtifact.css = entryArtifact.css.trim().length > 0 ? `${importLine}\n${entryArtifact.css}` : `${importLine}\n`
    entryArtifact.cssBytes = Buffer.byteLength(entryArtifact.css, 'utf8')
  }
}

async function buildTimcssPerEntryArtifacts(
  fileCandidates: Record<string, string[]>,
  allCandidates: string[],
  config: TimcssConfig,
) {
  let partition = partitionEntryCandidates(
    fileCandidates,
    allCandidates,
    config.output?.sharedCandidateMinUsage ?? 2,
  )
  let sharedArtifacts: TimcssBuiltArtifact[] = []
  let entryArtifacts: TimcssBuiltArtifact[] = []
  let preflightEnabled = config.preflight ?? config.platform !== 'wechat-miniprogram'

  if (preflightEnabled || partition.sharedCandidates.length > 0) {
    sharedArtifacts.push(
      await buildSplitArtifact('shared', partition.sharedCandidates, config, {
        outputFile: resolveSharedOutputFile(config),
        forceBuild: preflightEnabled,
      }),
    )
  }

  for (let sourceFile of Object.keys(fileCandidates)) {
    entryArtifacts.push(
      await buildSplitArtifact('entry', partition.entryCandidates[sourceFile] ?? [], { ...config, preflight: false }, {
        sourceFile,
        outputFile: resolveEntryOutputFile(config, sourceFile),
      }),
    )
  }

  injectSharedWechatImport(config, sharedArtifacts[0], entryArtifacts)

  return [...sharedArtifacts, ...entryArtifacts]
}

async function buildTimcssConfiguredEntryArtifacts(plan: TimcssEntryBuildPlan, config: TimcssConfig) {
  let groupedCandidates = Object.fromEntries(plan.entries.map((entry) => [entry.entryName, entry.candidates]))
  let partition = partitionEntryCandidates(
    groupedCandidates,
    plan.candidates,
    config.output?.sharedCandidateMinUsage ?? 2,
  )
  let sharedArtifacts: TimcssBuiltArtifact[] = []
  let entryArtifacts: TimcssBuiltArtifact[] = []
  let preflightEnabled = config.preflight ?? config.platform !== 'wechat-miniprogram'

  if (preflightEnabled || partition.sharedCandidates.length > 0) {
    sharedArtifacts.push(
      await buildSplitArtifact('shared', partition.sharedCandidates, config, {
        outputFile: resolveSharedOutputFile(config),
        forceBuild: preflightEnabled,
      }),
    )
  }

  for (let entry of plan.entries) {
    entryArtifacts.push(
      await buildSplitArtifact('entry', partition.entryCandidates[entry.entryName] ?? [], { ...config, preflight: false }, {
        outputFile: entry.outputFile,
        forceBuild: true,
        entryName: entry.entryName,
        sourcePatterns: entry.sourcePatterns,
      }),
    )
  }

  injectSharedWechatImport(config, sharedArtifacts[0], entryArtifacts)

  return [...sharedArtifacts, ...entryArtifacts]
}

export async function buildTimcssFromContent(
  content: string,
  config: TimcssConfig = {},
  options: {
    includeCatalogData?: boolean
    includeDiagnostics?: boolean
  } = {},
): Promise<TimcssBuildResult> {
  let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-inline-'))
  let tempFile = path.join(tempDir, 'inline.html')
  try {
    await fs.writeFile(tempFile, content, 'utf8')
    let scan = await scanFiles([tempFile])
    let needsCatalog = options.includeCatalogData !== false || options.includeDiagnostics !== false
    let catalog = needsCatalog ? await loadTimcssCatalog(config.cwd ?? process.cwd()) : null
    let duplicateDiagnostics = options.includeDiagnostics === false ? [] : createDuplicateUtilityDiagnostics(scan.rawFileCandidates)
    let result = await buildTimcssFromCandidates(scan.candidates, config, {
      catalog,
      extraDiagnostics: duplicateDiagnostics,
      includeCatalogData: options.includeCatalogData,
      includeDiagnostics: options.includeDiagnostics,
    })
    return { ...result, files: [tempFile] }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

export async function inspectTimcss(config: TimcssConfig = {}) {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  let scan = await scanFromConfig(resolved)
  let catalog = await loadTimcssCatalog(resolved.cwd ?? process.cwd())
  let known = toKnownTimcssSets(catalog)
  let diagnosticsInput =
    resolved.diagnostics?.enabled === false
      ? []
      : runDiagnostics(scan.candidates, resolved.platform, {
          ...known,
          prefix: resolved.prefix,
        })
  let rawDiagnostics = [...diagnosticsInput, ...createDuplicateUtilityDiagnostics(scan.rawFileCandidates)]
  let diagnostics = filterDiagnosticsByLevel(rawDiagnostics, resolved.diagnostics?.level)
  let catalogData = await enrichWithCatalog(unique(scan.candidates), diagnostics, resolved.cwd ?? process.cwd(), catalog, resolved.prefix)
  return { ...scan, diagnostics: catalogData.diagnostics, catalog: catalogData.catalog, candidateMatches: catalogData.candidateMatches }
}

export async function buildTimcssFromFiles(
  config: TimcssConfig = {},
  options: {
    includeCatalogData?: boolean
    includeDiagnostics?: boolean
  } = {},
): Promise<TimcssBuildResult> {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  let scan = await scanFromConfig(resolved)
  return buildTimcssFromScan(scan, resolved, options)
}

export async function buildTimcssFromScan(
  scan: TimcssScanResult,
  config: TimcssConfig = {},
  options: {
    includeCatalogData?: boolean
    includeDiagnostics?: boolean
  } = {},
): Promise<TimcssBuildResult> {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  let configuredEntryPlan = resolveConfiguredEntryPlan(scan.fileCandidates, scan.candidates, resolved)
  let effectiveFiles = configuredEntryPlan?.matchedFiles ?? Object.keys(scan.fileCandidates)
  let effectiveFileCandidates = Object.fromEntries(
    effectiveFiles.map((file) => [file, scan.fileCandidates[file] ?? []]),
  )
  let effectiveRawFileCandidates = Object.fromEntries(
    effectiveFiles.map((file) => [file, scan.rawFileCandidates?.[file] ?? []]),
  )
  let effectiveCandidates = configuredEntryPlan?.candidates ?? scan.candidates
  let needsCatalog = options.includeCatalogData !== false || options.includeDiagnostics !== false
  let catalog = needsCatalog ? await loadTimcssCatalog(resolved.cwd ?? process.cwd()) : null
  let duplicateDiagnostics =
    options.includeDiagnostics === false ? [] : createDuplicateUtilityDiagnostics(effectiveRawFileCandidates)
  let includeCatalogData = options.includeCatalogData !== false
  let includeDiagnostics = options.includeDiagnostics !== false
  let shouldLoadCatalog = includeCatalogData || includeDiagnostics
  let resolvedCatalog = shouldLoadCatalog ? catalog : null
  let known = includeDiagnostics ? toKnownTimcssSets(resolvedCatalog) : { knownUtilities: undefined, knownVariants: undefined }
  let diagnosticsInput =
    !includeDiagnostics || resolved.diagnostics?.enabled === false
      ? []
      : runDiagnostics(effectiveCandidates, resolved.platform, {
          ...known,
          prefix: resolved.prefix,
        })
  let rawDiagnostics = includeDiagnostics ? [...diagnosticsInput, ...duplicateDiagnostics] : []
  let diagnostics = includeDiagnostics ? filterDiagnosticsByLevel(rawDiagnostics, resolved.diagnostics?.level) : []
  let catalogData = includeCatalogData
    ? await enrichWithCatalog(unique(effectiveCandidates), diagnostics, resolved.cwd ?? process.cwd(), resolvedCatalog, resolved.prefix)
    : {
        catalog: resolvedCatalog,
        candidateMatches: [] as TimcssCandidateCatalogMatch[],
        diagnostics,
      }
  let outputMode = resolveFileBuildOutputMode(resolved, effectiveFiles.length)
  let built: TimcssBuildResult =
    outputMode === 'per-entry'
      ? {
          css: '',
          sourcemap: null as string | null,
          minified: false,
          diagnostics: catalogData.diagnostics,
          catalog: catalogData.catalog,
          candidateMatches: catalogData.candidateMatches,
          entry: '',
          candidates: effectiveCandidates,
          artifacts: configuredEntryPlan
            ? await buildTimcssConfiguredEntryArtifacts(configuredEntryPlan, resolved)
            : await buildTimcssPerEntryArtifacts(effectiveFileCandidates, effectiveCandidates, resolved),
        }
      : await buildTimcssFromCandidates(effectiveCandidates, resolved, {
          catalog: resolvedCatalog,
          extraDiagnostics: duplicateDiagnostics,
          includeCatalogData: options.includeCatalogData,
          includeDiagnostics: options.includeDiagnostics,
        })
  return {
    ...built,
    files: effectiveFiles,
    filesScanned: effectiveFiles.length,
    fileCandidates: effectiveFileCandidates,
  }
}

export async function doctorTimcss(config: TimcssConfig = {}): Promise<TimcssDoctorReport> {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  let cwd = resolved.cwd ?? process.cwd()
  let issues: string[] = []
  let contentGlobs = resolved.content ?? []
  if (contentGlobs.length === 0) issues.push('No content globs configured.')

  let unmatchedGlobs: string[] = []
  for (let pattern of contentGlobs) {
    let files = await discoverFiles([pattern], cwd, resolved.exclude ?? [])
    if (files.length === 0) unmatchedGlobs.push(pattern)
  }
  if (unmatchedGlobs.length > 0) {
    issues.push(`Unmatched content globs: ${unmatchedGlobs.join(', ')}`)
  }

  let scan = await scanFromConfig(resolved)
  let configuredEntryPlan = resolveConfiguredEntryPlan(scan.fileCandidates, scan.candidates, resolved)
  if (scan.filesScanned === 0) issues.push('No files matched configured content globs.')
  if (scan.filesScanned > 0 && scan.candidates.length === 0) {
    issues.push('No class candidates were extracted from matched files.')
  }
  if (configuredEntryPlan) {
    for (let entry of configuredEntryPlan.entries) {
      if (entry.files.length === 0) {
        issues.push(`Configured output entry "${entry.entryName}" matched no files: ${entry.sourcePatterns.join(', ')}`)
      }
    }
    if (configuredEntryPlan.unmatchedFiles.length > 0) {
      let preview = configuredEntryPlan.unmatchedFiles
        .slice(0, 5)
        .map((file) => path.relative(cwd, file))
        .join(', ')
      issues.push(
        `Files matched \`content\` globs but were not assigned to \`output.entries\`: ${preview}${
          configuredEntryPlan.unmatchedFiles.length > 5 ? ', ...' : ''
        }`,
      )
    }
    for (let [file, owners] of Object.entries(configuredEntryPlan.overlappingFiles)) {
      issues.push(`Source file matched multiple output entries: ${path.relative(cwd, file)} -> ${owners.join(', ')}`)
    }
  }

  if (resolved.prefix && !isValidTimcssPrefix(resolved.prefix)) {
    issues.push('Invalid prefix. TimCSS prefix should only contain lowercase letters (e.g. `tm`).')
  }
  if (
    resolved.output?.file &&
    !resolved.output.file.endsWith('.css') &&
    !(resolved.platform === 'wechat-miniprogram' && resolved.output.file.endsWith('.wxss'))
  ) {
    issues.push('Output file should end with `.css` or `.wxss` for Wechat Mini Program builds.')
  }
  if (resolved.output?.mode === 'per-entry' && resolved.output?.file) {
    issues.push('`output.file` is ignored when `output.mode="per-entry"`. Use `output.dir` and `output.sharedFile` instead.')
  }
  if ((resolved.output?.entries?.length ?? 0) > 0 && resolved.output?.file) {
    issues.push('`output.file` is ignored when `output.entries` is configured. Use `output.dir` and per-entry `outputFile` instead.')
  }
  if (resolved.output?.entries) {
    let entryNames = new Set<string>()
    let outputFiles = new Set<string>()
    resolved.output.entries.forEach((entry, index) => {
      let label = `output.entries[${index}]`
      let entryName = entry.name?.trim() || `entry-${index + 1}`
      if (!entry.outputFile?.trim()) issues.push(`${label} is missing \`outputFile\`.`)
      if (!entry.include?.length) issues.push(`${label} should declare at least one \`include\` glob.`)
      if (entryNames.has(entryName)) issues.push(`Duplicate output entry name: ${entryName}`)
      entryNames.add(entryName)
      if (entry.outputFile) {
        let resolvedOutputFile = resolveConfiguredEntryOutputFile(resolved, entry.outputFile)
        if (outputFiles.has(resolvedOutputFile)) issues.push(`Duplicate output entry file: ${entry.outputFile}`)
        outputFiles.add(resolvedOutputFile)
      }
    })
  }
  if (
    resolved.output?.sharedCandidateMinUsage !== undefined &&
    (!Number.isInteger(resolved.output.sharedCandidateMinUsage) || resolved.output.sharedCandidateMinUsage < 2)
  ) {
    issues.push('`output.sharedCandidateMinUsage` should be an integer greater than or equal to 2.')
  }

  if (resolved.platform === 'mobile' && resolved.presets?.wechat?.enabled) {
    issues.push('Wechat preset is enabled while platform=mobile. This is allowed but usually unnecessary.')
  }
  let catalogPath = await findTimcssCatalogFile(cwd)
  let catalog = catalogPath ? JSON.parse(await fs.readFile(catalogPath, 'utf8')) : null
  if (!catalog) issues.push('Atomic utility catalog was not found. Run `pnpm run timcss:docs:generate` first.')
  let catalogSource: TimcssDoctorChecks['catalog']['source'] = null
  if (catalogPath) {
    let rel = path.relative(cwd, catalogPath)
    catalogSource = rel.startsWith('..') ? 'workspace' : 'project'
  }

  let workspaceChecks: TimcssDoctorChecks['workspace'] | undefined
  let workspaceRoot = await findTimcssWorkspaceRoot(cwd)
  if (workspaceRoot) {
    let requiredDocs = [
      'docs/README.md',
      'docs/local-development.md',
      'docs/release-preflight-checklist.md',
      'docs/atomic-utilities-index.json',
    ]
    let requiredExamples = ['examples/wechat-miniapp/timcss.config.json', 'examples/react-mobile/timcss.config.json']
    let requiredRootScripts = [
      'timcss:prepare',
      'timcss:test',
      'timcss:build',
      'timcss:inspect',
      'timcss:doctor',
      'timcss:benchmark',
      'timcss:benchmark:strict',
      'timcss:competitor:scorecard',
      'timcss:scanner:baseline',
      'timcss:release:smoke',
      'timcss:release:validate',
    ]

    let docsMissing: string[] = []
    for (let file of requiredDocs) {
      if (!(await fileExists(path.resolve(workspaceRoot, file)))) docsMissing.push(file)
    }

    let examplesMissing: string[] = []
    for (let file of requiredExamples) {
      if (!(await fileExists(path.resolve(workspaceRoot, file)))) examplesMissing.push(file)
    }

    let rootScriptsMissing: string[] = []
    try {
      let rootPkg = JSON.parse(await fs.readFile(path.resolve(workspaceRoot, 'package.json'), 'utf8'))
      for (let scriptName of requiredRootScripts) {
        if (!rootPkg.scripts?.[scriptName]) rootScriptsMissing.push(scriptName)
      }
    } catch {
      rootScriptsMissing.push('package.json')
    }

    workspaceChecks = {
      root: workspaceRoot,
      docsMissing,
      examplesMissing,
      rootScriptsMissing,
    }

    if (docsMissing.length > 0) issues.push(`Workspace docs missing: ${docsMissing.join(', ')}`)
    if (examplesMissing.length > 0) issues.push(`Workspace examples missing: ${examplesMissing.join(', ')}`)
    if (rootScriptsMissing.length > 0) issues.push(`Workspace root scripts missing: ${rootScriptsMissing.join(', ')}`)
  }

  let checks: TimcssDoctorChecks = {
    content: {
      globs: contentGlobs.length,
      unmatchedGlobs,
    },
    catalog: {
      found: !!catalog,
      path: catalogPath,
      source: catalogSource,
    },
    workspace: workspaceChecks,
  }

  return { ok: issues.length === 0, issues, filesScanned: scan.filesScanned, candidates: scan.candidates.length, checks }
}


export function toTimcssBuildJson(result: TimcssBuildResult, config: TimcssConfig = {}) {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  let builtArtifacts = getTimcssBuildArtifacts(result, resolved)
  let outputMode = builtArtifacts.some((artifact) => artifact.kind !== 'single') ? 'per-entry' : resolveOutputMode(resolved)
  let artifacts = builtArtifacts.map((artifact) => ({
      kind: artifact.kind,
      sourceFile: artifact.sourceFile,
      entryName: artifact.entryName,
      sourcePatterns: artifact.sourcePatterns,
      outputFile: artifact.outputFile,
      cssBytes: artifact.cssBytes,
      candidateCount: artifact.candidateCount,
      candidates: artifact.candidates,
    }))
  let payload: TimcssBuildJsonPayload = {
    platform: resolved.platform ?? 'mobile',
    density: resolved.density ?? 'comfortable',
    prefix: resolved.prefix ?? null,
    outputFile: outputMode === 'single' ? resolved.output?.file ?? null : null,
    outputMode,
    outputDir: outputMode === 'per-entry' ? resolved.output?.dir ?? 'dist' : null,
    minified: builtArtifacts.every((artifact) => artifact.minified),
    sourcemap: builtArtifacts.some((artifact) => !!artifact.sourcemap),
    sourcemapBytes:
      builtArtifacts.reduce((total, artifact) => total + Buffer.byteLength(artifact.sourcemap ?? '', 'utf8'), 0) || null,
    files: result.files ?? [],
    filesScanned: result.filesScanned ?? result.files?.length ?? 0,
    candidates: result.candidates,
    diagnostics: result.diagnostics,
    candidateMatches: result.candidateMatches,
    cssBytes: artifacts.reduce((total, artifact) => total + artifact.cssBytes, 0),
    artifacts,
    catalog: catalogSummary(result.catalog),
  }
  return createJsonEnvelope('build', payload)
}

export function toTimcssInspectJson(result: Awaited<ReturnType<typeof inspectTimcss>>, config: TimcssConfig = {}) {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  let payload: TimcssInspectJsonPayload = {
    platform: resolved.platform ?? 'mobile',
    density: resolved.density ?? 'comfortable',
    prefix: resolved.prefix ?? null,
    filesScanned: result.filesScanned,
    candidates: result.candidates,
    diagnostics: result.diagnostics,
    candidateMatches: result.candidateMatches,
    catalog: catalogSummary(result.catalog),
  }
  return createJsonEnvelope('inspect', payload)
}

export function toTimcssDoctorJson(result: Awaited<ReturnType<typeof doctorTimcss>>, config: TimcssConfig = {}) {
  let resolved = mergeConfig(DEFAULT_CONFIG, config)
  let payload: TimcssDoctorJsonPayload = {
    ok: result.ok,
    platform: resolved.platform ?? 'mobile',
    density: resolved.density ?? 'comfortable',
    prefix: resolved.prefix ?? null,
    filesScanned: result.filesScanned,
    candidates: result.candidates,
    issues: result.issues,
    catalog: { found: result.checks?.catalog.found ?? !result.issues.some((item) => item.includes('catalog')) },
    checks: result.checks,
  }
  return createJsonEnvelope('doctor', payload)
}

export function toTimcssCatalogJson(
  catalog: TimcssCatalogPayload,
  items: TimcssCatalogItem[],
  filters: TimcssCatalogJsonPayload['filters'] = {},
) {
  let payload: TimcssCatalogJsonPayload = {
    filters,
    count: items.length,
    catalog: {
      schemaVersion: catalog.schemaVersion,
      generatedAt: catalog.generatedAt,
      packageVersion: catalog.packageVersion,
    },
    items,
  }
  return createJsonEnvelope('catalog', payload)
}

function transformBuildCssOutput(css: string, config: TimcssConfig, candidates: string[] = []) {
  let minify = config.output?.minify ?? (config.platform === 'wechat-miniprogram' && !!config.output?.file)
  let sourcemap = config.output?.sourcemap === true
  let outputCss = normalizeWechatDeliveryCss(inlineMobileThemeTokens(css, config), config, candidates)
  let sourceCss = outputCss
  if (!minify && !sourcemap) {
    return { css: outputCss, sourcemap: null as string | null, minified: false }
  }

  let filename = config.output?.file ? path.basename(config.output.file) : 'timcss.css'
  let charMap: number[] | null = null
  if (minify) {
    if (sourcemap) {
      let transformed = minifyCssWithMap(outputCss)
      outputCss = transformed.css
      charMap = transformed.charMap
    } else {
      outputCss = minifyCss(outputCss)
    }
  } else if (sourcemap) {
    charMap = createIdentityCharMap(outputCss.length)
  }

  return {
    css: outputCss,
    sourcemap: sourcemap ? createSourceMap(outputCss, sourceCss, charMap ?? createIdentityCharMap(outputCss.length), filename) : null,
    minified: minify,
  }
}

function getMobileTokenReplacementMap(config: TimcssConfig) {
  let key = JSON.stringify({
    density: config.density ?? 'comfortable',
    overrides: config.theme?.overrides ?? {},
  })
  let cached = mobileTokenReplacementCache.get(key)
  if (cached) return cached

  let tokens = createMobileTokens(config.density ?? 'comfortable', config.theme?.overrides)
  let replacements = new Map<string, string>()
  replacements.set('--spacing', tokens.spacing)
  for (let [key, value] of Object.entries(tokens.fontSize)) replacements.set(`--text-${key}`, value)
  for (let [key, value] of Object.entries(tokens.lineHeight)) replacements.set(`--text-${key}--line-height`, value)
  for (let [key, value] of Object.entries(tokens.radius)) replacements.set(`--radius${key === 'DEFAULT' ? '' : `-${key}`}`, value)
  for (let [key, value] of Object.entries(tokens.controlHeight)) replacements.set(`--control-${key}`, value)
  for (let [key, value] of Object.entries(tokens.layout)) replacements.set(`--layout-${key}`, value)
  for (let [key, value] of Object.entries(tokens.colors)) replacements.set(`--color-${key}`, value)
  for (let [key, value] of Object.entries(tokens.shadows)) replacements.set(`--shadow-${key}`, value)
  mobileTokenReplacementCache.set(key, replacements)
  return replacements
}

function inlineMobileThemeTokens(css: string, config: TimcssConfig) {
  let shouldInline = config.inlineThemeTokens ?? config.platform === 'wechat-miniprogram'
  if (!shouldInline) return css

  let replacements = getMobileTokenReplacementMap(config)
  let output = css
  for (let [variable, value] of replacements) {
    let reference = `var(${variable})`
    if (output.includes(reference)) output = output.replaceAll(reference, value)
  }

  for (let variable of replacements.keys()) {
    let escaped = escapeRegExp(variable)
    output = output.replace(new RegExp(`\\n\\s*${escaped}:\\s*[^;]+;`, 'g'), '')
    output = output.replace(new RegExp(`\\s*${escaped}:\\s*[^;]+;`, 'g'), '')
  }

  output = output
    .replace(/^@layer theme, base, components, utilities;\s*/m, '')
    .replace(/@layer theme\s*\{\s*:root,\s*:host\s*\{\s*\}\s*\}\s*/g, '')
    .replace(/:root,\s*:host\s*\{\s*\}\s*/g, '')
    .replace(/\n{3,}/g, '\n\n')

  return output.trimEnd() + '\n'
}

function normalizeWechatDeliveryCss(css: string, config: TimcssConfig, candidates: string[] = []) {
  if (config.platform !== 'wechat-miniprogram') return css

  if (config.inlineThemeTokens === false || css.includes('@layer theme')) {
    let parsed = parseCssBlocks(css)
    if (parsed.length === 0) return css
    let rules = flattenWechatRules(parsed)
    return rules.length > 0 ? renderWechatRules(rules) : css
  }

  let utilitiesBody = extractCssBlockBody(css, '@layer utilities')
  if (!utilitiesBody) return css

  if (!hasVariantCandidates(candidates)) return utilitiesBody.trimEnd() + '\n'

  let rules = flattenWechatRules(parseCssBlocks(utilitiesBody))
  return rules.length > 0 ? renderWechatRules(rules) : css
}

type ParsedCssBlock = {
  selector: string
  body: string
  start: number
  end: number
}

type FlatCssRule = {
  selector: string
  body: string
}

function flattenWechatRules(blocks: ParsedCssBlock[]) {
  let rules: FlatCssRule[] = []
  let seen = new Set<string>()
  for (let block of blocks) {
    if (block.selector.startsWith('@layer ')) {
      for (let child of flattenWechatRules(parseCssBlocks(block.body))) {
        let fingerprint = `${child.selector}{${child.body}}`
        if (seen.has(fingerprint)) continue
        seen.add(fingerprint)
        rules.push(child)
      }
      continue
    }

    let flattened = flattenNestedWechatRule(block)
    let fingerprint = `${flattened.selector}{${flattened.body}}`
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    rules.push(flattened)
  }
  return rules
}

function flattenNestedWechatRule(block: ParsedCssBlock): FlatCssRule {
  if (!block.body.includes('{')) {
    return { selector: normalizeCssWhitespace(block.selector), body: block.body.trim() }
  }

  let nested = parseCssBlocks(block.body)
  if (nested.length !== 1) {
    return { selector: normalizeCssWhitespace(block.selector), body: block.body.trim() }
  }

  let [child] = nested
  let remainder = `${block.body.slice(0, child.start)}${block.body.slice(child.end)}`.trim()
  if (remainder.length > 0) {
    return { selector: normalizeCssWhitespace(block.selector), body: block.body.trim() }
  }

  let selector = normalizeCssWhitespace(child.selector.replaceAll('&', block.selector).replace(/\s*,\s*/g, ', '))
  return { selector, body: child.body.trim() }
}

function serializeCssRule(selector: string, body: string) {
  return `${selector} {\n  ${formatDeclarationBlock(body)}\n}`
}

function renderWechatRules(rules: FlatCssRule[]) {
  return rules.map((rule) => serializeCssRule(rule.selector, rule.body)).join('\n').trimEnd() + '\n'
}

function normalizeCssWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function formatDeclarationBlock(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s*;\s*/g, ';\n  ')
    .replace(/\n  $/, '')
}

function parseCssBlocks(input: string): ParsedCssBlock[] {
  let blocks: ParsedCssBlock[] = []
  let index = 0

  while (index < input.length) {
    index = skipCssTrivia(input, index)
    if (index >= input.length) break

    let selectorStart = index
    let depth = 0
    while (index < input.length) {
      let current = input[index]
      if (current === '"' || current === "'") {
        index = skipCssString(input, index)
        continue
      }
      if (current === '(' || current === '[') depth++
      else if ((current === ')' || current === ']') && depth > 0) depth--
      else if (current === '{' && depth === 0) break
      index++
    }

    if (index >= input.length) break

    let selector = input.slice(selectorStart, index).trim()
    let bodyStart = index + 1
    let bodyEnd = findCssBlockEnd(input, index)
    if (bodyEnd < 0) break

    blocks.push({
      selector,
      body: input.slice(bodyStart, bodyEnd).trim(),
      start: selectorStart,
      end: bodyEnd + 1,
    })
    index = bodyEnd + 1
  }

  return blocks
}

function extractCssBlockBody(input: string, selector: string) {
  let selectorIndex = input.indexOf(selector)
  if (selectorIndex < 0) return null

  let openBraceIndex = input.indexOf('{', selectorIndex + selector.length)
  if (openBraceIndex < 0) return null

  let closeBraceIndex = findCssBlockEnd(input, openBraceIndex)
  if (closeBraceIndex < 0) return null

  return input.slice(openBraceIndex + 1, closeBraceIndex).trim()
}

function hasVariantCandidates(candidates: string[]) {
  return candidates.some((candidate) => candidate.includes(':'))
}

function skipCssTrivia(input: string, index: number) {
  while (index < input.length) {
    if (/\s/.test(input[index])) {
      index++
      continue
    }
    if (input[index] === '/' && input[index + 1] === '*') {
      index += 2
      while (index < input.length && !(input[index] === '*' && input[index + 1] === '/')) index++
      index += 2
      continue
    }
    break
  }
  return index
}

function skipCssString(input: string, index: number) {
  let quote = input[index]
  index++
  while (index < input.length) {
    if (input[index] === '\\') {
      index += 2
      continue
    }
    if (input[index] === quote) return index + 1
    index++
  }
  return index
}

function findCssBlockEnd(input: string, openBraceIndex: number) {
  let depth = 1
  let index = openBraceIndex + 1

  while (index < input.length) {
    let current = input[index]
    if (current === '"' || current === "'") {
      index = skipCssString(input, index)
      continue
    }
    if (current === '/' && input[index + 1] === '*') {
      index = skipCssTrivia(input, index)
      continue
    }
    if (current === '{') depth++
    else if (current === '}') {
      depth--
      if (depth === 0) return index
    }
    index++
  }

  return -1
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createIdentityCharMap(length: number) {
  return Array.from({ length }, (_, index) => index)
}

function minifyCss(css: string) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim()
}

function minifyCssWithMap(css: string) {
  let transformed = minifyCssInternal(css, true)
  return { css: transformed.css, charMap: transformed.charMap ?? [] }
}

function minifyCssInternal(css: string, includeCharMap = false) {
  let out: string[] = []
  let charMap = includeCharMap ? ([] as number[]) : null
  let i = 0
  while (i < css.length) {
    let current = css[i]
    let next = css[i + 1] ?? ''

    if (current === '/' && next === '*') {
      i += 2
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i++
      i += 2
      continue
    }

    if (/\s/.test(current)) {
      let start = i
      while (i < css.length && /\s/.test(css[i])) i++
      let nextIndex = i
      while (nextIndex < css.length && css[nextIndex] === '/' && css[nextIndex + 1] === '*') {
        nextIndex += 2
        while (nextIndex < css.length && !(css[nextIndex] === '*' && css[nextIndex + 1] === '/')) nextIndex++
        nextIndex += 2
        while (nextIndex < css.length && /\s/.test(css[nextIndex])) nextIndex++
      }

      let prevOutput = out[out.length - 1]
      let nextOutput = css[nextIndex]
      if (!prevOutput || !nextOutput) {
        continue
      }

      if (canDropSpace(prevOutput, nextOutput)) {
        continue
      }

      if (prevOutput !== ' ') {
        out.push(' ')
        charMap?.push(start)
      }
      continue
    }

    out.push(current)
    charMap?.push(i)
    i++
  }

  let compact: string[] = []
  let compactMap = includeCharMap ? ([] as number[]) : null
  for (let index = 0; index < out.length; index++) {
    let ch = out[index]
    if (ch === ';') {
      let lookahead = index + 1
      while (lookahead < out.length && out[lookahead] === ' ') lookahead++
      if (out[lookahead] === '}') continue
    }
    compact.push(ch)
    compactMap?.push(charMap?.[index] ?? 0)
  }

  if (compact[0] === ' ') {
    compact.shift()
    compactMap?.shift()
  }
  if (compact[compact.length - 1] === ' ') {
    compact.pop()
    compactMap?.pop()
  }

  return { css: compact.join(''), charMap: compactMap }
}

function canDropSpace(previous: string, next: string) {
  return CSS_NO_SPACE_PUNCTUATION.has(previous) || CSS_NO_SPACE_PUNCTUATION.has(next)
}

function createSourceMap(generatedCss: string, sourceCss: string, charMap: number[], file: string) {
  let lineStarts = computeLineStarts(sourceCss)
  let mappings = createMappings(generatedCss, charMap, lineStarts)
  return JSON.stringify({
    version: 3,
    file,
    sources: [file],
    sourcesContent: [sourceCss],
    names: [],
    mappings,
  })
}

function computeLineStarts(source: string) {
  let starts = [0]
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') starts.push(i + 1)
  }
  return starts
}

function sourceIndexToLineColumn(index: number, lineStarts: number[]) {
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    let mid = (low + high) >> 1
    if (lineStarts[mid] <= index) low = mid + 1
    else high = mid - 1
  }
  let line = Math.max(0, high)
  let column = index - lineStarts[line]
  return { line, column }
}

function createMappings(generated: string, charMap: number[], sourceLineStarts: number[]) {
  let lines = generated.split('\n')
  let lineMappings: string[] = []
  let generatedCursor = 0
  let prevSource = 0
  let prevSourceLine = 0
  let prevSourceColumn = 0

  for (let lineText of lines) {
    if (lineText.length === 0) {
      lineMappings.push('')
      generatedCursor += 1
      continue
    }

    let segments: string[] = []
    let prevGeneratedColumn = 0
    for (let column = 0; column < lineText.length; column++) {
      let outputIndex = generatedCursor + column
      let sourceIndex = charMap[outputIndex] ?? 0
      let { line, column: sourceColumn } = sourceIndexToLineColumn(sourceIndex, sourceLineStarts)
      let segment =
        encodeVlq(column - prevGeneratedColumn) +
        encodeVlq(0 - prevSource) +
        encodeVlq(line - prevSourceLine) +
        encodeVlq(sourceColumn - prevSourceColumn)
      segments.push(segment)
      prevGeneratedColumn = column
      prevSource = 0
      prevSourceLine = line
      prevSourceColumn = sourceColumn
    }

    lineMappings.push(segments.join(','))
    generatedCursor += lineText.length + 1
  }

  return lineMappings.join(';')
}

function encodeVlq(value: number) {
  let base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let vlq = value < 0 ? ((-value) << 1) + 1 : value << 1
  let encoded = ''
  do {
    let digit = vlq & 31
    vlq >>>= 5
    if (vlq > 0) digit |= 32
    encoded += base64[digit]
  } while (vlq > 0)
  return encoded
}

function createDuplicateUtilityDiagnostics(rawFileCandidates?: Record<string, string[]>) {
  if (!rawFileCandidates) return []

  let diagnostics: TimcssDiagnostic[] = []
  for (let [file, candidates] of Object.entries(rawFileCandidates)) {
    let previous = ''
    let runCount = 0
    let flushRun = () => {
      if (!previous || runCount < 2) return
      diagnostics.push({
        code: 'TIM009',
        level: 'info',
        file,
        className: previous,
        message: `检测到重复原子类：${previous}（连续 ${runCount} 次）`,
        suggestion: '移除重复 utility，保持 class 组合简洁且可维护。',
      })
    }

    for (let className of candidates) {
      if (className === previous) {
        runCount += 1
        continue
      }

      flushRun()
      previous = className
      runCount = 1
    }
    flushRun()
  }

  return diagnostics
}
