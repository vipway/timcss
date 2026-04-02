export type TimcssDensity = 'compact' | 'comfortable' | 'spacious'
export type TimcssPlatform = 'mobile' | 'wechat-miniprogram'

export type TimcssVariantName =
  | 'pressed'
  | 'disabled'
  | 'safe'
  | 'notch'
  | 'tabbar-present'
  | 'keyboard-open'

export type TimcssThemeOverrides = {
  spacing?: string
  fontSize?: Record<string, string>
  lineHeight?: Record<string, string>
  radius?: Record<string, string>
  controlHeight?: Record<string, string>
  layout?: Record<string, string>
  colors?: Record<string, string>
  shadows?: Record<string, string>
}

export type TimcssVariantOptions = {
  enabled?: boolean
  prefix?: string
  include?: TimcssVariantName[]
  exclude?: TimcssVariantName[]
  selectors?: Partial<Record<TimcssVariantName, string>>
}

export interface TimcssPresetExtension {
  name: string
  getCss(config: TimcssConfig): string
}

export type TimcssDiagnosticsOutput = 'pretty' | 'json'
export type TimcssDiagnosticLevel = 'info' | 'warning' | 'error'
export type TimcssCatalogItemStatus = 'stable' | 'experimental'
export type TimcssCatalogItemKind = 'utility' | 'variant'
export type TimcssOutputMode = 'single' | 'per-entry'
export type TimcssBuildArtifactKind = 'single' | 'shared' | 'entry'

export interface TimcssOutputEntryConfig {
  name?: string
  include: string[]
  exclude?: string[]
  outputFile: string
}

export interface TimcssDiagnostic {
  code: string
  level: TimcssDiagnosticLevel
  message: string
  suggestion?: string
  file?: string
  className?: string
  catalogMatches?: TimcssCatalogItem[]
}

export interface TimcssCatalogItem {
  id: string
  className: string
  kind: TimcssCatalogItemKind
  category: string
  intent: string
  output: string
  whenToUse: string
  modifiers?: string[]
  platforms: TimcssPlatform[]
  sourcePackage: string
  status: TimcssCatalogItemStatus
  since: string
  schemaVersion: string
}

export interface TimcssCatalogPayload {
  schemaVersion: string
  generatedAt: string
  packageVersion: string
  items: TimcssCatalogItem[]
}

export interface TimcssCandidateCatalogMatch {
  candidate: string
  matches: TimcssCatalogItem[]
}

export interface TimcssCommandJsonEnvelope<TCommand extends string, TPayload> {
  tool: 'timcss'
  command: TCommand
  schemaVersion: '1'
  generatedAt: string
  payload: TPayload
}

export interface TimcssBuildJsonPayload {
  platform: TimcssPlatform
  density: TimcssDensity
  prefix: string | null
  outputFile: string | null
  outputMode: TimcssOutputMode
  outputDir: string | null
  minified: boolean
  sourcemap: boolean
  sourcemapBytes: number | null
  files: string[]
  filesScanned: number
  candidates: string[]
  diagnostics: TimcssDiagnostic[]
  candidateMatches: TimcssCandidateCatalogMatch[]
  cssBytes: number
  artifacts: TimcssBuildArtifactSummary[]
  catalog: Pick<TimcssCatalogPayload, 'schemaVersion' | 'generatedAt' | 'packageVersion'> | null
}

export interface TimcssBuildArtifactSummary {
  kind: TimcssBuildArtifactKind
  sourceFile: string | null
  entryName: string | null
  sourcePatterns: string[] | null
  outputFile: string | null
  cssBytes: number
  candidateCount: number
  candidates: string[]
}

export interface TimcssInspectJsonPayload {
  platform: TimcssPlatform
  density: TimcssDensity
  prefix: string | null
  filesScanned: number
  candidates: string[]
  diagnostics: TimcssDiagnostic[]
  candidateMatches: TimcssCandidateCatalogMatch[]
  catalog: Pick<TimcssCatalogPayload, 'schemaVersion' | 'generatedAt' | 'packageVersion'> | null
}

export interface TimcssDoctorChecks {
  content: {
    globs: number
    unmatchedGlobs: string[]
  }
  catalog: {
    found: boolean
    path: string | null
    source: 'project' | 'workspace' | null
  }
  workspace?: {
    root: string
    docsMissing: string[]
    examplesMissing: string[]
    rootScriptsMissing: string[]
  }
}

export interface TimcssDoctorReport {
  ok: boolean
  filesScanned: number
  candidates: number
  issues: string[]
  checks?: TimcssDoctorChecks
}

export interface TimcssDoctorJsonPayload {
  ok: boolean
  platform: TimcssPlatform
  density: TimcssDensity
  prefix: string | null
  filesScanned: number
  candidates: number
  issues: string[]
  catalog: { found: boolean }
  checks?: TimcssDoctorChecks
}

export interface TimcssCatalogJsonPayload {
  filters: {
    className?: string
    platform?: string
    status?: string
    kind?: string
    query?: string
    intent?: string
    sourcePackage?: string
  }
  count: number
  catalog: Pick<TimcssCatalogPayload, 'schemaVersion' | 'generatedAt' | 'packageVersion'>
  items: TimcssCatalogItem[]
}

export interface TimcssConfig {
  platform?: TimcssPlatform
  density?: TimcssDensity
  prefix?: string
  cwd?: string
  preflight?: boolean
  inlineThemeTokens?: boolean
  content?: string[]
  exclude?: string[]
  diagnostics?: {
    enabled?: boolean
    level?: TimcssDiagnosticLevel
    output?: TimcssDiagnosticsOutput
  }
  theme?: {
    overrides?: TimcssThemeOverrides
  }
  variants?: TimcssVariantOptions
  presets?: {
    mobile?: {
      enabled?: boolean
      includeLayouts?: boolean
      includeControls?: boolean
      includeSemanticColors?: boolean
    }
    wechat?: {
      enabled?: boolean
    }
    recipes?: {
      enabled?: boolean
    }
  }
  output?: {
    file?: string
    dir?: string
    mode?: TimcssOutputMode
    entries?: TimcssOutputEntryConfig[]
    sharedFile?: string
    sharedCandidateMinUsage?: number
    minify?: boolean
    sourcemap?: boolean
  }
}

export interface TimcssCandidate {
  value: string
  source?: string
}

export interface TimcssScanResult {
  filesScanned: number
  candidates: string[]
  fileCandidates: Record<string, string[]>
  rawFileCandidates?: Record<string, string[]>
}

export {
  TIMCSS_INTENT_SYNONYMS,
  expandTimcssIntentTerms,
  includesTimcssTerm,
  isTimcssIntentQuery,
  isTimcssIntentTerm,
  normalizeTimcssIntentQuery,
  splitTimcssSearchTerms,
} from './search'

export function mergeConfig(base: TimcssConfig = {}, next: TimcssConfig = {}): TimcssConfig {
  return {
    ...base,
    ...next,
    diagnostics: { ...(base.diagnostics ?? {}), ...(next.diagnostics ?? {}) },
    output: { ...(base.output ?? {}), ...(next.output ?? {}) },
    variants: {
      ...(base.variants ?? {}),
      ...(next.variants ?? {}),
      selectors: { ...(base.variants?.selectors ?? {}), ...(next.variants?.selectors ?? {}) },
      include: next.variants?.include ?? base.variants?.include,
      exclude: next.variants?.exclude ?? base.variants?.exclude,
    },
    presets: {
      mobile: { ...(base.presets?.mobile ?? {}), ...(next.presets?.mobile ?? {}) },
      wechat: { ...(base.presets?.wechat ?? {}), ...(next.presets?.wechat ?? {}) },
      recipes: { ...(base.presets?.recipes ?? {}), ...(next.presets?.recipes ?? {}) },
    },
    theme: {
      overrides: {
        ...(base.theme?.overrides ?? {}),
        ...(next.theme?.overrides ?? {}),
        fontSize: {
          ...(base.theme?.overrides?.fontSize ?? {}),
          ...(next.theme?.overrides?.fontSize ?? {}),
        },
        lineHeight: {
          ...(base.theme?.overrides?.lineHeight ?? {}),
          ...(next.theme?.overrides?.lineHeight ?? {}),
        },
        radius: { ...(base.theme?.overrides?.radius ?? {}), ...(next.theme?.overrides?.radius ?? {}) },
        controlHeight: {
          ...(base.theme?.overrides?.controlHeight ?? {}),
          ...(next.theme?.overrides?.controlHeight ?? {}),
        },
        layout: { ...(base.theme?.overrides?.layout ?? {}), ...(next.theme?.overrides?.layout ?? {}) },
        colors: { ...(base.theme?.overrides?.colors ?? {}), ...(next.theme?.overrides?.colors ?? {}) },
        shadows: { ...(base.theme?.overrides?.shadows ?? {}), ...(next.theme?.overrides?.shadows ?? {}) },
      },
    },
  }
}

export function splitClassTokens(input: string): string[] {
  return input
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean)
}

export function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)]
}
