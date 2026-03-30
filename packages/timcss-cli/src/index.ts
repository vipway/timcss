import nodeFs from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildTimcssFromScan,
  buildTimcssFromContent,
  buildTimcssFromFiles,
  createTimcssCssEntry,
  doctorTimcss,
  filterCatalogItems,
  getTimcssBuildArtifacts,
  inspectTimcss,
  loadTimcssCatalog,
  loadTimcssConfig,
  toTimcssBuildJson,
  toTimcssCatalogJson,
  toTimcssDoctorJson,
  toTimcssInspectJson,
} from '@timcss/engine'
import { formatDiagnostics } from '@timcss/diagnostics'
import type { TimcssCandidateCatalogMatch, TimcssConfig, TimcssScanResult } from '@timcss/core'
import type { TimcssBuildResult, TimcssBuiltArtifact } from '@timcss/engine'
import { discoverFiles, extractStaticContentRoot, matchesFilePatterns, scanFiles } from '@timcss/scanner'
import { pathExists } from './fs'
import {
  collapseWatchDirectories,
  createTimcssWatchHandle,
  resolveIgnoredWatchPaths,
  type TimcssWatchBackendKind,
  type TimcssWatchHandle,
} from './watch'

// JSON envelope: all `--json` commands return the shared TimCSS command envelope.
function parseArgs(argv: string[]) {
  let out: Record<string, string | boolean> = {}
  let positionals: string[] = []
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i]
    if (arg === '--') continue
    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }
    let key = arg.slice(2)
    let eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    let next = argv[i + 1]
    if (!next || next.startsWith('--')) out[key] = true
    else {
      out[key] = next
      i++
    }
  }
  return { flags: out, positionals }
}

function withRuntimeFlags(base: TimcssConfig, flags: Record<string, string | boolean>): TimcssConfig {
  let sharedCandidateMinUsage =
    typeof flags['shared-min-usage'] === 'string' ? Number.parseInt(flags['shared-min-usage'], 10) : undefined
  return {
    ...base,
    platform:
      typeof flags.platform === 'string'
        ? (flags.platform as TimcssConfig['platform'])
        : flags.wechat === true
          ? 'wechat-miniprogram'
          : base.platform,
    density: typeof flags.density === 'string' ? (flags.density as TimcssConfig['density']) : base.density,
    prefix: typeof flags.prefix === 'string' ? flags.prefix : base.prefix,
    output: {
      ...(base.output ?? {}),
      file: typeof flags.out === 'string' ? flags.out : base.output?.file,
      dir: typeof flags['out-dir'] === 'string' ? flags['out-dir'] : base.output?.dir,
      mode:
        typeof flags.split === 'string'
          ? (flags.split as NonNullable<TimcssConfig['output']>['mode'])
          : base.output?.mode,
      sharedFile:
        typeof flags['shared-file'] === 'string' ? flags['shared-file'] : base.output?.sharedFile,
      sharedCandidateMinUsage:
        sharedCandidateMinUsage !== undefined &&
        Number.isInteger(sharedCandidateMinUsage) &&
        sharedCandidateMinUsage >= 2
          ? sharedCandidateMinUsage
          : base.output?.sharedCandidateMinUsage,
    },
  }
}

function renderCandidateMatches(matches: TimcssCandidateCatalogMatch[]) {
  if (matches.length === 0) return 'No matched TimCSS atomic metadata.'
  return matches
    .map(
      (item) =>
        `- ${item.candidate}\n${item.matches
          .map(
            (match) =>
              `    • ${match.id} | ${match.className} | ${match.status} | ${match.sourcePackage} | ${match.platforms.join('/')}`,
          )
          .join('\n')}`,
    )
    .join('\n')
}

function printHelp() {
  process.stdout.write(`timcss <command> [options]\n\nCommands:\n  build        Build CSS\n  dev          Watch files and rebuild on change\n  inspect      Print diagnostics and atomic metadata\n  doctor       Check config and content coverage\n  print-entry  Print final CSS entry\n  catalog      Search TimCSS atomic metadata catalog\n\nOptions:\n  --config <file>\n  --platform <mobile|wechat-miniprogram>\n  --wechat\n  --density <compact|comfortable|spacious>\n  --prefix <prefix>\n  --content <inline html/string>\n  --out <file>\n  --out-dir <dir>\n  --split <single|per-entry>\n  --shared-file <file>\n  --shared-min-usage <n>\n  --debounce <ms>\n  --watch-backend <auto|native|polling>\n  --poll-interval <ms>\n  --once\n  --class <className>\n  --status <stable|experimental>\n  --kind <utility|variant>\n  --query <text>\n  --intent <text>\n  --source-package <pkg>\n  --json\n`)
}

async function writeCssArtifact(asset: {
  outputFile: string
  css: string
  sourcemap: string | null
  cwd?: string
}) {
  let out = path.resolve(asset.cwd ?? process.cwd(), asset.outputFile)
  let css = asset.css
  let mapOut: string | null = null
  await fs.mkdir(path.dirname(out), { recursive: true })
  if (typeof asset.sourcemap === 'string') {
    mapOut = `${out}.map`
    let mapRefComment = `/*# sourceMappingURL=${path.basename(mapOut)} */`
    if (!css.includes('sourceMappingURL=')) {
      css = `${css}\n${mapRefComment}\n`
    }
    await fs.writeFile(mapOut, asset.sourcemap, 'utf8')
  }
  await fs.writeFile(out, css, 'utf8')
  return { out, mapOut }
}

function resolveConfigWatchFiles(configPath?: string) {
  if (configPath) return [path.resolve(process.cwd(), configPath)]
  let cwd = process.cwd()
  return ['timcss.config.json', 'timcss.config.mjs', 'timcss.config.js'].map((file) => path.resolve(cwd, file))
}

function resolveDevWatchDirectories(config: TimcssConfig, configPath?: string) {
  let cwd = config.cwd ?? process.cwd()
  let contentRoots = (config.content ?? []).map(extractStaticContentRoot).map((entry) => path.resolve(cwd, entry))
  let configRoots = resolveConfigWatchFiles(configPath).map((file) => path.dirname(file))
  let roots = [...contentRoots, ...configRoots]
  return collapseWatchDirectories(roots.length > 0 ? roots : [cwd])
}

function parseIntegerFlag(value: string | boolean | undefined, fallback: number) {
  if (typeof value !== 'string') return fallback
  let parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseWatchBackendFlag(value: string | boolean | undefined): TimcssWatchBackendKind {
  if (value === 'native' || value === 'polling') return value
  return 'auto'
}

function resolveDevIgnoredPaths(config: TimcssConfig) {
  let cwd = config.cwd ?? process.cwd()
  let ignored: string[] = []
  if (config.output?.dir) ignored.push(path.resolve(cwd, config.output.dir))
  if (config.output?.file) {
    let outputFile = path.resolve(cwd, config.output.file)
    ignored.push(outputFile, `${outputFile}.map`)
  }
  return resolveIgnoredWatchPaths(ignored)
}

type TimcssEmittedAssetSnapshot = {
  css: string
  sourcemap: string | null
}

const CLI_MINIMAL_BUILD_OPTIONS = {
  includeCatalogData: false,
  includeDiagnostics: false,
} as const

function resolveCliBuildOptions(flags: Record<string, string | boolean>) {
  return flags.json ? undefined : CLI_MINIMAL_BUILD_OPTIONS
}

async function runBuildCommand(flags: Record<string, string | boolean>, config: TimcssConfig): Promise<TimcssBuildResult> {
  let options = resolveCliBuildOptions(flags)
  return typeof flags.content === 'string'
    ? await buildTimcssFromContent(flags.content, config, options)
    : await buildTimcssFromFiles(config, options)
}

async function emitBuildArtifacts(
  result: TimcssBuildResult,
  config: TimcssConfig,
  options: {
    previousAssets?: Map<string, TimcssEmittedAssetSnapshot>
  } = {},
) {
  let previousAssets = options.previousAssets
  let written: Array<
    TimcssBuiltArtifact & {
      out: string
      mapOut: string | null
      skipped: boolean
    }
  > = []

  let assets = getTimcssBuildArtifacts(result, config)
  if (assets.length > 1 || assets[0]?.kind !== 'single') {
    let manifestFiles: string[] = []
    for (let asset of assets) {
      if (!asset.outputFile) continue
      let out = path.resolve(config.cwd ?? process.cwd(), asset.outputFile)
      let mapOut = typeof asset.sourcemap === 'string' ? `${out}.map` : null
      manifestFiles.push(out, ...(mapOut ? [mapOut] : []))
      let previous = previousAssets?.get(out)
      if (previous && previous.css === asset.css && previous.sourcemap === asset.sourcemap) {
        written.push({ ...asset, out, mapOut, skipped: true })
        continue
      }
      let emitted = await writeCssArtifact({
        outputFile: out,
        css: asset.css,
        sourcemap: asset.sourcemap,
        cwd: config.cwd,
      })
      written.push({ ...asset, ...emitted, skipped: false })
    }
    let outputDir = path.resolve(config.cwd ?? process.cwd(), config.output?.dir ?? 'dist')
    await syncPerEntryBuildManifest(outputDir, manifestFiles)
    if (previousAssets) {
      previousAssets.clear()
      for (let asset of assets) {
        if (!asset.outputFile) continue
        let out = path.resolve(config.cwd ?? process.cwd(), asset.outputFile)
        previousAssets.set(out, {
          css: asset.css,
          sourcemap: asset.sourcemap,
        })
      }
    }
    return {
      mode: 'artifacts' as const,
      assets: written,
      writtenCount: written.filter((asset) => !asset.skipped).length,
      assetCount: assets.filter((asset) => !!asset.outputFile).length,
    }
  }

  let singleAsset = assets[0]
  if (singleAsset?.outputFile) {
    let out = path.resolve(config.cwd ?? process.cwd(), singleAsset.outputFile)
    let previous = previousAssets?.get(out)
    let mapOut = singleAsset.sourcemap ? `${out}.map` : null
    let skipped = !!previous && previous.css === singleAsset.css && previous.sourcemap === (singleAsset.sourcemap ?? null)
    if (!skipped) {
      let emitted = await writeCssArtifact({
        outputFile: singleAsset.outputFile,
        css: singleAsset.css,
        sourcemap: singleAsset.sourcemap ?? null,
        cwd: config.cwd,
      })
      mapOut = emitted.mapOut
    }
    if (previousAssets) {
      previousAssets.clear()
      previousAssets.set(out, {
        css: singleAsset.css,
        sourcemap: singleAsset.sourcemap ?? null,
      })
    }
    return {
      mode: 'single' as const,
      file: out,
      mapOut,
      skipped,
    }
  }

  return {
    mode: 'stdout' as const,
    css: singleAsset?.css ?? result.css,
  }
}

function renderEmittedBuildSummary(
  emitted: Awaited<ReturnType<typeof emitBuildArtifacts>>,
  result: TimcssBuildResult,
) {
  if (emitted.mode === 'artifacts') {
    let lines = [`Built ${emitted.assetCount} assets (${result.candidates.length} candidates)`]
    for (let asset of emitted.assets) {
      let sourceSuffix = asset.sourceFile
        ? ` <- ${asset.sourceFile}`
        : asset.entryName
          ? ` <- ${asset.entryName}${asset.sourcePatterns?.length ? ` [${asset.sourcePatterns.join(', ')}]` : ''}`
          : ''
      let mapSuffix = asset.mapOut ? ` + ${asset.mapOut}` : ''
      let skippedSuffix = asset.skipped ? ' [cached]' : ''
      lines.push(`- ${asset.kind}: ${asset.out}${mapSuffix} (${asset.candidateCount} candidates)${sourceSuffix}${skippedSuffix}`)
    }
    return lines.join('\n')
  }

  if (emitted.mode === 'single') {
    let mapSuffix = emitted.mapOut ? ` + ${emitted.mapOut}` : ''
    let cachedSuffix = emitted.skipped ? ' [cached]' : ''
    return `Built ${emitted.file}${mapSuffix} (${result.candidates.length} candidates)${cachedSuffix}`
  }

  return emitted.css
}

async function loadPerEntryBuildManifest(file: string) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as { files?: string[] }
  } catch {
    return null
  }
}

async function syncPerEntryBuildManifest(outputDir: string, emittedFiles: string[]) {
  let manifestFile = path.join(outputDir, '.timcss-build-manifest.json')
  let previous = await loadPerEntryBuildManifest(manifestFile)
  let current = new Set(emittedFiles.map((file) => path.resolve(file)))
  let legacyGeneratedFiles = [path.join(outputDir, 'app.wxss'), path.join(outputDir, 'shared.css')]
  for (let staleFile of previous?.files ?? []) {
    let absolute = path.resolve(staleFile)
    if (current.has(absolute)) continue
    await fs.rm(absolute, { force: true })
  }
  for (let legacyFile of legacyGeneratedFiles) {
    let absolute = path.resolve(legacyFile)
    if (current.has(absolute)) continue
    await fs.rm(absolute, { force: true })
  }
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(manifestFile, JSON.stringify({ files: [...current] }, null, 2) + '\n', 'utf8')
}

async function createInitialScan(config: TimcssConfig): Promise<TimcssScanResult> {
  let files = await discoverFiles(config.content ?? [], config.cwd ?? process.cwd(), config.exclude ?? [])
  return scanFiles(files)
}

async function applyIncrementalScanUpdates(
  scan: TimcssScanResult,
  changedFiles: string[],
  config: TimcssConfig,
): Promise<TimcssScanResult> {
  let cwd = config.cwd ?? process.cwd()
  let fileCandidates = { ...(scan.fileCandidates ?? {}) }
  let rawFileCandidates = { ...(scan.rawFileCandidates ?? {}) }
  for (let file of changedFiles) {
    let absolute = path.resolve(file)
    let matches = matchesFilePatterns(absolute, config.content ?? [], cwd, config.exclude ?? [])
    let exists = await pathExists(absolute)
    if (!matches || !exists) {
      delete fileCandidates[absolute]
      delete rawFileCandidates[absolute]
      continue
    }
    let partial = await scanFiles([absolute])
    fileCandidates[absolute] = partial.fileCandidates[absolute] ?? []
    rawFileCandidates[absolute] = partial.rawFileCandidates?.[absolute] ?? []
  }
  return {
    filesScanned: Object.keys(fileCandidates).length,
    fileCandidates,
    rawFileCandidates,
    candidates: [...new Set(Object.values(fileCandidates).flat())],
  }
}

async function runTimcssDev(
  flags: Record<string, string | boolean>,
  runtimeConfig: TimcssConfig,
  configPath?: string,
) {
  if (typeof flags.content === 'string') {
    process.stderr.write('TimCSS dev does not support `--content`. Use file-based `content` globs.\n')
    return 1
  }

  let debounceMs = Math.max(16, parseIntegerFlag(flags.debounce, 60))
  let pollIntervalMs = Math.max(50, parseIntegerFlag(flags['poll-interval'], 200))
  let watchBackend = parseWatchBackendFlag(flags['watch-backend'])
  let once = flags.once === true
  let watchAssets = new Map<string, TimcssEmittedAssetSnapshot>()
  let currentConfig = runtimeConfig
  let validateDevConfig = (config: TimcssConfig) => {
    if (config.platform !== 'wechat-miniprogram' && !config.output?.file && !config.output?.dir) {
      throw new Error('TimCSS dev requires `output.file` or `output.dir`. For WeChat, use `--wechat` or set `platform: "wechat-miniprogram"`.')
    }
  }
  try {
    validateDevConfig(currentConfig)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
  let watchDirectories = resolveDevWatchDirectories(currentConfig, configPath)
  let configWatchFiles = new Set(resolveConfigWatchFiles(configPath).map((file) => path.resolve(file)))
  let currentScan = await createInitialScan(currentConfig)
  let watchHandle: TimcssWatchHandle | null = null
  let activeWatchBackend: TimcssWatchBackendKind | 'native' | 'polling' = watchBackend
  let pendingFiles = new Set<string>()
  let pendingConfigReload = false
  let rebuildTimer: NodeJS.Timeout | null = null
  let rebuilding = false
  let rerunRequested = false

  async function rebuild(reason: string, changedFiles: string[]) {
    let startedAt = process.hrtime.bigint()
    let result = await buildTimcssFromScan(currentScan, currentConfig, {
      includeCatalogData: false,
      includeDiagnostics: false,
    })
    let emitted = await emitBuildArtifacts(result as Awaited<ReturnType<typeof buildTimcssFromFiles>>, currentConfig, {
      previousAssets: watchAssets,
    })
    let durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    let changedSummary = changedFiles.length > 0 ? ` <- ${changedFiles.map((file) => path.relative(currentConfig.cwd ?? process.cwd(), file)).join(', ')}` : ''
    process.stdout.write(`[timcss:dev] ${reason} ${durationMs.toFixed(1)}ms${changedSummary}\n`)
    if (emitted.mode === 'stdout') process.stdout.write(emitted.css)
    else process.stdout.write(renderEmittedBuildSummary(emitted, result as Awaited<ReturnType<typeof buildTimcssFromFiles>>) + '\n')
  }

  async function resetWatchers() {
    await watchHandle?.close()
    let resolvedWatchDirectories = resolveDevWatchDirectories(currentConfig, configPath)
    let existingWatchDirectories: string[] = []
    for (let directory of resolvedWatchDirectories) {
      if (await pathExists(directory)) existingWatchDirectories.push(directory)
    }
    watchDirectories = existingWatchDirectories.length > 0 ? existingWatchDirectories : [currentConfig.cwd ?? process.cwd()]
    watchHandle = await createTimcssWatchHandle({
      backend: watchBackend,
      directories: watchDirectories,
      ignorePaths: resolveDevIgnoredPaths(currentConfig),
      pollIntervalMs,
      onChange(paths) {
        for (let changedPath of paths) {
          if (configWatchFiles.has(changedPath)) pendingConfigReload = true
          else pendingFiles.add(changedPath)
        }
        scheduleRebuild()
      },
      onError(error) {
        process.stderr.write(`[timcss:dev] watch error: ${error.message}\n`)
      },
    })
    activeWatchBackend = watchHandle.backend
  }

  async function performRebuild() {
    if (rebuilding) {
      rerunRequested = true
      return
    }

    rebuilding = true
    do {
      rerunRequested = false
      let changedFiles = [...pendingFiles]
      pendingFiles.clear()
      let shouldReloadConfig = pendingConfigReload
      pendingConfigReload = false
      try {
        if (shouldReloadConfig) {
          let baseConfig = await loadTimcssConfig(configPath)
          currentConfig = withRuntimeFlags(baseConfig, flags)
          validateDevConfig(currentConfig)
          configWatchFiles = new Set(resolveConfigWatchFiles(configPath).map((file) => path.resolve(file)))
          currentScan = await createInitialScan(currentConfig)
          await resetWatchers()
          await rebuild('reloaded config', changedFiles)
          continue
        }
        currentScan = await applyIncrementalScanUpdates(currentScan, changedFiles, currentConfig)
        await rebuild(changedFiles.length > 0 ? 'rebuilt' : 'built', changedFiles)
      } catch (error) {
        let message = error instanceof Error ? error.message : String(error)
        process.stderr.write(`[timcss:dev] ${message}\n`)
      }
    } while (rerunRequested)
    rebuilding = false
  }

  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(() => {
      rebuildTimer = null
      void performRebuild()
    }, debounceMs)
  }

  await rebuild('initial build', [])
  if (once) return 0

  await resetWatchers()
  process.stdout.write(`[timcss:dev] watching ${watchDirectories.length} directories via ${activeWatchBackend}\n`)

  return await new Promise<number>((resolve) => {
    let stopping = false
    let stop = async (code: number) => {
      if (stopping) return
      stopping = true
      if (rebuildTimer) clearTimeout(rebuildTimer)
      await watchHandle?.close()
      watchHandle = null
      resolve(code)
    }
    process.stdin.resume()
    process.once('SIGINT', () => void stop(0))
    process.once('SIGTERM', () => void stop(0))
  })
}

export async function runTimcssCli(argv: string[] = process.argv.slice(2)) {
  let { flags, positionals } = parseArgs(argv)
  let command = positionals[0] ?? 'build'
  let knownCommands = new Set(['build', 'dev', 'inspect', 'doctor', 'print-entry', 'catalog'])
  if (flags.help || flags.h) {
    printHelp()
    return 0
  }
  if (!knownCommands.has(command)) {
    process.stderr.write(`Unknown TimCSS command: ${command}\n\n`)
    printHelp()
    return 1
  }

  let baseConfig = await loadTimcssConfig(typeof flags.config === 'string' ? flags.config : undefined)
  let config = withRuntimeFlags(baseConfig, flags)

  if (command === 'dev') {
    return runTimcssDev(flags, config, typeof flags.config === 'string' ? flags.config : undefined)
  }

  if (command === 'print-entry') {
    process.stdout.write(createTimcssCssEntry(config))
    return 0
  }

  if (command === 'catalog') {
    let catalog = await loadTimcssCatalog(config.cwd ?? process.cwd())
    if (!catalog) {
      process.stderr.write('TimCSS catalog not found. Run `pnpm run timcss:docs:generate` first.\n')
      return 1
    }

    let items = filterCatalogItems(catalog.items, {
      className: typeof flags.class === 'string' ? flags.class : undefined,
      platform: typeof flags.platform === 'string' ? flags.platform : undefined,
      status: typeof flags.status === 'string' ? flags.status : undefined,
      kind: typeof flags.kind === 'string' ? flags.kind : undefined,
      query: typeof flags.query === 'string' ? flags.query : undefined,
      intent: typeof flags.intent === 'string' ? flags.intent : undefined,
      sourcePackage: typeof flags['source-package'] === 'string' ? flags['source-package'] : undefined,
    })

    if (flags.json) {
      process.stdout.write(
        JSON.stringify(
          toTimcssCatalogJson(catalog, items, {
            className: typeof flags.class === 'string' ? flags.class : undefined,
            platform: typeof flags.platform === 'string' ? flags.platform : undefined,
            status: typeof flags.status === 'string' ? flags.status : undefined,
            kind: typeof flags.kind === 'string' ? flags.kind : undefined,
            query: typeof flags.query === 'string' ? flags.query : undefined,
            intent: typeof flags.intent === 'string' ? flags.intent : undefined,
            sourcePackage: typeof flags['source-package'] === 'string' ? flags['source-package'] : undefined,
          }),
          null,
          2,
        ) + '\n',
      )
      return 0
    }

    process.stdout.write(`TimCSS catalog\n  items: ${items.length}\n  schema: ${catalog.schemaVersion}\n  version: ${catalog.packageVersion}\n\n`)
    if (items.length === 0) {
      process.stdout.write('No catalog items matched.\n')
      return 0
    }

    process.stdout.write(
      items
        .map(
          (item) =>
            `- ${item.className}\n  id: ${item.id}\n  kind: ${item.kind}\n  status: ${item.status}\n  package: ${item.sourcePackage}\n  platforms: ${item.platforms.join('/')}\n  intent: ${item.intent}\n  output: ${item.output}`,
        )
        .join('\n\n') + '\n',
    )
    return 0
  }

  if (command === 'doctor') {
    let report = await doctorTimcss(config)
    if (flags.json) {
      process.stdout.write(JSON.stringify(toTimcssDoctorJson(report, config), null, 2) + '\n')
      return report.ok ? 0 : 1
    }
    process.stdout.write(`${report.ok ? 'OK' : 'WARN'} files=${report.filesScanned} candidates=${report.candidates}\n`)
    if (report.checks?.content.unmatchedGlobs.length) {
      process.stdout.write(`unmatched globs: ${report.checks.content.unmatchedGlobs.join(', ')}\n`)
    }
    if (report.checks?.catalog.path) {
      process.stdout.write(`catalog: ${report.checks.catalog.source} ${report.checks.catalog.path}\n`)
    }
    if (report.issues.length > 0) process.stdout.write(report.issues.map((item) => `- ${item}`).join('\n') + '\n')
    return report.ok ? 0 : 1
  }

  if (command === 'inspect') {
    let report = await inspectTimcss(config)
    let format = flags.json ? 'json' : config.diagnostics?.output ?? 'pretty'
    if (format === 'json') {
      process.stdout.write(JSON.stringify(toTimcssInspectJson(report, config), null, 2) + '\n')
      return 0
    }

    let summary = [
      `TimCSS inspect`,
      `  files scanned: ${report.filesScanned}`,
      `  candidates: ${report.candidates.length}`,
      `  diagnostics: ${report.diagnostics.length}`,
      `  metadata matches: ${report.candidateMatches.length}`,
      report.catalog
        ? `  catalog: schema=${report.catalog.schemaVersion} version=${report.catalog.packageVersion}`
        : `  catalog: not found`,
    ].join('\n')

    process.stdout.write(summary + '\n\n')
    process.stdout.write(formatDiagnostics(report.diagnostics, format) + '\n\n')
    process.stdout.write('Matched atomic metadata\n')
    process.stdout.write(renderCandidateMatches(report.candidateMatches) + '\n')
    return 0
  }

  let result = await runBuildCommand(flags, config)
  if (flags.json) {
    process.stdout.write(JSON.stringify(toTimcssBuildJson(result, config), null, 2) + '\n')
    return 0
  }
  let emitted = await emitBuildArtifacts(result, config)
  process.stdout.write(renderEmittedBuildSummary(emitted, result) + '\n')
  return 0
}

async function main() {
  process.exitCode = await runTimcssCli()
}

function isDirectExecution() {
  if (!process.argv[1]) return false
  let entryPath = fileURLToPath(import.meta.url)
  let argvPath = path.resolve(process.argv[1])
  if (argvPath === entryPath) return true
  try {
    return nodeFs.realpathSync.native(argvPath) === nodeFs.realpathSync.native(entryPath)
  } catch {
    return false
  }
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
