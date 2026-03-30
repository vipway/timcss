import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import {
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
} from '../src/index'

test('creates entry css', () => {
  let entry = createTimcssCssEntry({ platform: 'wechat-miniprogram', prefix: 'tm' })
  expect(entry).toContain('@theme')
  expect(entry).toContain("tailwindcss/theme.css")
  expect(entry).not.toContain('tailwindcss/preflight.css')
})

test('mobile entry keeps preflight by default', () => {
  let entry = createTimcssCssEntry({ platform: 'mobile' })
  expect(entry).toContain('tailwindcss/preflight.css')
})

test('entry prunes unused TimCSS layers when build selection is empty', () => {
  let entry = createTimcssCssEntry(
    { platform: 'wechat-miniprogram' },
    { mobileUtilities: [], wechatUtilities: [], variants: [] },
  )
  expect(entry).not.toContain('--layout-page:')
  expect(entry).not.toContain('@custom-variant')
  expect(entry).not.toContain('@utility px-page')
  expect(entry).not.toContain('@utility pb-safe')
})

test('builds css from inline content', async () => {
  let result = await buildTimcssFromContent('<div class="px-page pb-safe"></div>', { platform: 'wechat-miniprogram' })
  expect(result.css).toContain('.px-page')
  expect(result.css).toContain('.pb-safe')
  expect(result.css).toContain('padding-inline: 32rpx')
  expect(result.css).not.toContain('var(--layout-page)')
  expect(result.css).not.toContain('@layer utilities')
})

test('mobile build keeps theme token variables by default', async () => {
  let result = await buildTimcssFromContent('<div class="px-page bg-primary"></div>', { platform: 'mobile' })
  expect(result.css).toContain('var(--layout-page)')
  expect(result.css).toContain('--layout-page:')
  expect(result.css).toContain('--color-primary:')
  expect(result.css).not.toContain('--layout-section:')
  expect(result.css).not.toContain('--shadow-card:')
})

test('wechat build keeps Tailwind core path for non-TimCSS utilities', async () => {
  let result = await buildTimcssFromContent('<div class="flex"></div>', { platform: 'wechat-miniprogram' })
  expect(result.css).toContain('.flex')
  expect(result.css).toContain('display: flex')
  expect(result.css).not.toContain('--layout-page:')
  expect(result.css).not.toContain('@custom-variant')
})

test('wechat build can opt out of theme token inlining', async () => {
  let result = await buildTimcssFromContent('<div class="px-page bg-primary"></div>', {
    platform: 'wechat-miniprogram',
    inlineThemeTokens: false,
  })
  expect(result.css).toContain('var(--layout-page)')
  expect(result.css).toContain('--layout-page:')
  expect(result.css).toContain('--color-primary:')
  expect(result.css).not.toContain('--layout-section:')
})

test('wechat file build defaults to minified delivery css', async () => {
  let result = await buildTimcssFromContent('<div class="px-page bg-primary"></div>', {
    platform: 'wechat-miniprogram',
    output: { file: 'dist/timcss.css' },
  })
  expect(result.minified).toBe(true)
  expect(result.css.includes('\n  .tm-px-page')).toBe(false)
  expect(result.css).not.toContain('@layer utilities')
})

test('wechat file build can opt out of default minify', async () => {
  let result = await buildTimcssFromContent('<div class="px-page bg-primary"></div>', {
    platform: 'wechat-miniprogram',
    output: { file: 'dist/timcss.css', minify: false },
  })
  expect(result.minified).toBe(false)
  expect(result.css).toContain('.px-page {')
  expect(result.css).not.toContain('@layer utilities')
})

test('wechat build flattens pressed and safe variants for delivery css', async () => {
  let result = await buildTimcssFromContent('<div class="pressed:opacity-80 safe:px-page"></div>', {
    platform: 'wechat-miniprogram',
  })
  expect(result.css).toContain('.pressed\\:opacity-80:active')
  expect(result.css).toContain('[data-safe-area="true"] .safe\\:px-page')
  expect(result.css).not.toContain('&:active')
  expect(result.css).not.toContain('@layer utilities')
})

test('wechat build deduplicates flattened disabled selectors', async () => {
  let result = await buildTimcssFromContent('<button class="disabled:bg-primary"></button>', {
    platform: 'wechat-miniprogram',
  })
  expect(result.css).toContain('.disabled\\:bg-primary[disabled], .disabled\\:bg-primary:disabled, .disabled\\:bg-primary[aria-disabled="true"]')
  expect(result.css.match(/disabled\\:bg-primary/g)?.length).toBe(3)
})

test('uses catalog context to report unknown TimCSS utility', async () => {
  let result = await buildTimcssFromContent('<div class="bg-surfacex"></div>', { cwd: process.cwd() })
  expect(result.diagnostics.some((item) => item.code === 'TIM006')).toBe(true)
})

test('inspect exposes metadata matches', async () => {
  let report = await inspectTimcss({
    cwd: process.cwd(),
    content: ['examples/wechat-miniapp/src/pages/index/index.wxml'],
    platform: 'wechat-miniprogram',
    prefix: 'tm',
  })
  expect(report.candidateMatches.some((item) => item.candidate === 'tm-px-page')).toBe(true)
})

test('catalog filters by class and platform', async () => {
  let catalog = await loadTimcssCatalog(process.cwd())
  expect(catalog).not.toBeNull()
  let filtered = filterCatalogItems(catalog!.items, { className: 'px-page', platform: 'mobile', kind: 'utility' })
  expect(filtered).toHaveLength(1)
  expect(filtered[0].className).toBe('px-page')
})

test('build json envelope includes command metadata', async () => {
  let result = await buildTimcssFromContent('<div class="px-page"></div>', { cwd: process.cwd(), content: [] })
  let json = toTimcssBuildJson({ ...result, files: [], filesScanned: 0, fileCandidates: {} }, { platform: 'mobile' })
  expect(json.tool).toBe('timcss')
  expect(json.command).toBe('build')
  expect(json.payload.candidates).toContain('px-page')
  expect(json.payload.outputMode).toBe('single')
  expect(json.payload.artifacts[0].kind).toBe('single')
})

test('per-entry build extracts shared candidates and entry-only css', async () => {
  let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-split-build-'))
  try {
    await fs.mkdir(path.join(tempDir, 'src', 'pages'), { recursive: true })
    await fs.writeFile(
      path.join(tempDir, 'src', 'pages', 'home.wxml'),
      '<view class="tm-px-page tm-bg-primary"></view>',
      'utf8',
    )
    await fs.writeFile(
      path.join(tempDir, 'src', 'pages', 'profile.wxml'),
      '<view class="tm-px-page tm-text-primary"></view>',
      'utf8',
    )

    let result = await buildTimcssFromFiles({
      cwd: tempDir,
      platform: 'wechat-miniprogram',
      prefix: 'tm',
      content: ['src/**/*.wxml'],
      output: { mode: 'per-entry', dir: 'dist', minify: false },
    })

    let artifacts = getTimcssBuildArtifacts(result)
    let shared = artifacts.find((item) => item.kind === 'shared')
    let home = artifacts.find((item) => item.kind === 'entry' && item.sourceFile?.endsWith('home.wxml'))
    let profile = artifacts.find((item) => item.kind === 'entry' && item.sourceFile?.endsWith('profile.wxml'))

    expect(shared).toBeTruthy()
    expect(home).toBeTruthy()
    expect(profile).toBeTruthy()
    if (!shared || !home || !profile) throw new Error('Expected shared/home/profile artifacts to exist')
    expect(shared.css).toContain('.tm-px-page {')
    expect(shared.css).not.toContain('.tm-bg-primary')
    expect(shared.outputFile).toBe(path.resolve(tempDir, 'dist', 'app.wxss'))
    expect(home.css).toContain('@import "../app.wxss";')
    expect(home.css).toContain('.tm-bg-primary {')
    expect(home.css).not.toContain('.tm-px-page')
    expect(home.outputFile).toBe(path.resolve(tempDir, 'dist', 'pages', 'home.wxss'))
    expect(profile.css).toContain('@import "../app.wxss";')
    expect(profile.css).toContain('.tm-text-primary {')
    expect(profile.css).not.toContain('.tm-px-page')
    expect(profile.outputFile).toBe(path.resolve(tempDir, 'dist', 'pages', 'profile.wxss'))
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('wechat file build defaults to per-entry output when no output file is configured', async () => {
  let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-wechat-auto-split-'))
  try {
    await fs.mkdir(path.join(tempDir, 'src', 'pages', 'index'), { recursive: true })
    await fs.writeFile(
      path.join(tempDir, 'src', 'pages', 'index', 'index.wxml'),
      '<view class="tm-px-page tm-bg-primary"></view>',
      'utf8',
    )

    let result = await buildTimcssFromFiles({
      cwd: tempDir,
      platform: 'wechat-miniprogram',
      prefix: 'tm',
      content: ['src/**/*.wxml'],
    })

    let artifacts = getTimcssBuildArtifacts(result)
    expect(artifacts.some((item) => item.kind === 'shared')).toBe(false)
    expect(artifacts.some((item) => item.outputFile?.endsWith(path.join('pages', 'index', 'index.wxss')))).toBe(true)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('configured output entries control per-entry source scope', async () => {
  let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-configured-entries-'))
  try {
    await fs.mkdir(path.join(tempDir, 'src', 'pages', 'home'), { recursive: true })
    await fs.mkdir(path.join(tempDir, 'src', 'pages', 'profile'), { recursive: true })
    await fs.writeFile(
      path.join(tempDir, 'src', 'pages', 'home', 'index.wxml'),
      '<view class="tm-px-page tm-bg-primary"></view>',
      'utf8',
    )
    await fs.writeFile(
      path.join(tempDir, 'src', 'pages', 'profile', 'index.wxml'),
      '<view class="tm-px-page tm-text-primary"></view>',
      'utf8',
    )
    await fs.writeFile(
      path.join(tempDir, 'src', 'orphan.wxml'),
      '<view class="tm-pb-safe"></view>',
      'utf8',
    )

    let result = await buildTimcssFromFiles({
      cwd: tempDir,
      platform: 'wechat-miniprogram',
      prefix: 'tm',
      content: ['src/**/*.wxml'],
      output: {
        mode: 'per-entry',
        dir: 'dist',
        minify: false,
        entries: [
          {
            name: 'home',
            include: ['src/pages/home/**/*.wxml'],
            outputFile: 'bundle/home.wxss',
          },
          {
            name: 'profile',
            include: ['src/pages/profile/**/*.wxml'],
            outputFile: 'bundle/profile.wxss',
          },
        ],
      },
    })

    let artifacts = getTimcssBuildArtifacts(result)
    let files = result.files ?? []
    let shared = artifacts.find((item) => item.kind === 'shared')
    let home = artifacts.find((item) => item.kind === 'entry' && item.entryName === 'home')
    let profile = artifacts.find((item) => item.kind === 'entry' && item.entryName === 'profile')

    expect(files).toHaveLength(2)
    expect(files.some((file) => file.endsWith('orphan.wxml'))).toBe(false)
    expect(result.candidates).toContain('tm-px-page')
    expect(result.candidates).not.toContain('tm-pb-safe')
    expect(shared).toBeTruthy()
    expect(home).toBeTruthy()
    expect(profile).toBeTruthy()
    if (!shared || !home || !profile) throw new Error('Expected shared/home/profile artifacts to exist')
    expect(shared.outputFile).toBe(path.resolve(tempDir, 'dist', 'app.wxss'))
    expect(home.outputFile).toBe(path.resolve(tempDir, 'dist', 'bundle', 'home.wxss'))
    expect(home.sourcePatterns).toEqual(['src/pages/home/**/*.wxml'])
    expect(home.css).toContain('@import "../app.wxss";')
    expect(home.css).toContain('.tm-bg-primary {')
    expect(home.css).not.toContain('.tm-pb-safe')
    expect(profile.outputFile).toBe(path.resolve(tempDir, 'dist', 'bundle', 'profile.wxss'))
    expect(profile.css).toContain('.tm-text-primary {')
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('per-entry mobile build keeps preflight in shared asset', async () => {
  let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-split-preflight-'))
  try {
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'src', 'home.html'), '<div class="px-page"></div>', 'utf8')
    await fs.writeFile(path.join(tempDir, 'src', 'profile.html'), '<div class="py-section"></div>', 'utf8')

    let result = await buildTimcssFromFiles({
      cwd: tempDir,
      platform: 'mobile',
      content: ['src/**/*.html'],
      output: { mode: 'per-entry', dir: 'dist', minify: false },
    })

    let artifacts = getTimcssBuildArtifacts(result)
    let shared = artifacts.find((item) => item.kind === 'shared')
    let entries = artifacts.filter((item) => item.kind === 'entry')

    expect(shared).toBeTruthy()
    if (!shared) throw new Error('Expected shared artifact to exist')
    expect(shared.candidateCount).toBe(0)
    expect(shared.css.length).toBeGreaterThan(0)
    expect(entries).toHaveLength(2)
    expect(entries.every((item) => item.css.includes('.'))).toBe(true)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('inspect json envelope includes catalog summary', async () => {
  let report = await inspectTimcss({ cwd: process.cwd(), content: ['examples/react-mobile/**/*.{tsx,html,json}'] })
  let json = toTimcssInspectJson(report, { platform: 'mobile' })
  expect(json.command).toBe('inspect')
  expect(Array.isArray(json.payload.diagnostics)).toBe(true)
})

test('doctor json envelope exposes ok and catalog state', () => {
  let json = toTimcssDoctorJson({ ok: false, issues: ['catalog missing'], filesScanned: 0, candidates: 0 }, { platform: 'mobile' })
  expect(json.command).toBe('doctor')
  expect(json.payload.catalog.found).toBe(false)
})

test('doctor warns when configured output entries omit matched files', async () => {
  let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-doctor-entries-'))
  try {
    await fs.mkdir(path.join(tempDir, 'src', 'pages', 'home'), { recursive: true })
    await fs.writeFile(
      path.join(tempDir, 'src', 'pages', 'home', 'index.wxml'),
      '<view class="tm-px-page"></view>',
      'utf8',
    )
    await fs.writeFile(path.join(tempDir, 'src', 'orphan.wxml'), '<view class="tm-pb-safe"></view>', 'utf8')

    let report = await doctorTimcss({
      cwd: tempDir,
      platform: 'wechat-miniprogram',
      prefix: 'tm',
      content: ['src/**/*.wxml'],
      output: {
        mode: 'per-entry',
        dir: 'dist',
        entries: [{ name: 'home', include: ['src/pages/home/**/*.wxml'], outputFile: 'pages/home.wxss' }],
      },
    })

    expect(report.ok).toBe(false)
    expect(report.issues.some((item) => item.includes('not assigned to `output.entries`'))).toBe(true)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('load config resolves cwd from explicit config path', async () => {
  let config = await loadTimcssConfig('examples/wechat-miniapp/timcss.config.json', process.cwd())
  expect(config.cwd).toBe(path.resolve(process.cwd(), 'examples/wechat-miniapp'))
})

test('doctor reports unmatched content glob and invalid prefix/output', async () => {
  let report = await doctorTimcss({
    cwd: process.cwd(),
    content: ['__missing__/**/*.wxml'],
    prefix: 'tm-1',
    output: { file: 'dist/timcss.txt' },
  })
  expect(report.ok).toBe(false)
  expect(report.checks?.content.unmatchedGlobs).toContain('__missing__/**/*.wxml')
  expect(report.issues.some((item) => item.includes('Invalid prefix'))).toBe(true)
  expect(report.issues.some((item) => item.includes('`.css`'))).toBe(true)
})

test('doctor accepts minify and sourcemap output options', async () => {
  let report = await doctorTimcss({
    cwd: process.cwd(),
    content: ['examples/react-mobile/src/**/*.{tsx,jsx,html}'],
    output: { file: 'dist/timcss.css', minify: true, sourcemap: true },
  })
  expect(report.issues.some((item) => item.includes('output.minify'))).toBe(false)
  expect(report.issues.some((item) => item.includes('output.sourcemap'))).toBe(false)
})

test('doctor accepts wxss output file for wechat single-file builds', async () => {
  let report = await doctorTimcss({
    cwd: process.cwd(),
    platform: 'wechat-miniprogram',
    content: ['examples/wechat-miniapp/src/**/*.wxml'],
    output: { file: 'dist/timcss.wxss' },
  })
  expect(report.issues.some((item) => item.includes('`.css` or `.wxss`'))).toBe(false)
})

test('catalog json envelope keeps filters and items', async () => {
  let catalog = await loadTimcssCatalog(process.cwd())
  expect(catalog).not.toBeNull()
  let filtered = filterCatalogItems(catalog!.items, { query: 'safe' })
  let json = toTimcssCatalogJson(catalog!, filtered, { query: 'safe' })
  expect(json.command).toBe('catalog')
  expect(json.payload.filters.query).toBe('safe')
  expect(json.payload.count).toBe(filtered.length)
})

test('catalog supports intent search and returns ranked items', async () => {
  let catalog = await loadTimcssCatalog(process.cwd())
  expect(catalog).not.toBeNull()
  let filtered = filterCatalogItems(catalog!.items, {
    intent: 'intent:底部安全区 吸底',
    platform: 'wechat-miniprogram',
  })
  expect(filtered.length).toBeGreaterThan(0)
  let top = filtered.slice(0, 3).map((item) => item.className)
  expect(top.some((item) => item === 'pb-safe' || item === 'pb-tabbar-safe')).toBe(true)
})

test('build supports output minify option', async () => {
  let baseline = await buildTimcssFromContent('<div class="px-page py-section"></div>', {
    cwd: process.cwd(),
    output: { minify: false },
  })
  let minified = await buildTimcssFromContent('<div class="px-page py-section"></div>', {
    cwd: process.cwd(),
    output: { minify: true },
  })

  expect(minified.minified).toBe(true)
  expect(minified.css.length).toBeLessThan(baseline.css.length)
})

test('build supports output sourcemap option and exposes build json fields', async () => {
  let result = await buildTimcssFromContent('<div class="px-page"></div>', {
    cwd: process.cwd(),
    output: { file: 'dist/timcss.css', sourcemap: true },
  })
  expect(typeof result.sourcemap).toBe('string')
  expect(result.sourcemap).toContain('"version":3')
  let parsed = JSON.parse(result.sourcemap!)
  expect(typeof parsed.mappings).toBe('string')
  expect(parsed.mappings.length).toBeGreaterThan(0)
  let firstMappedLine = parsed.mappings
    .split(';')
    .find((line: string) => line.length > 0)
  expect(firstMappedLine).toBeTruthy()
  expect(firstMappedLine.split(',').length).toBeGreaterThan(10)

  let json = toTimcssBuildJson(
    { ...result, files: [], filesScanned: 0, fileCandidates: {} },
    { platform: 'mobile', output: { file: 'dist/timcss.css', sourcemap: true } },
  )
  expect(json.payload.sourcemap).toBe(true)
  expect(json.payload.sourcemapBytes).toBeGreaterThan(0)
})

test('build sourcemap keeps pre-minified source content when minify is enabled', async () => {
  let result = await buildTimcssFromContent('<div class="px-page py-section"></div>', {
    cwd: process.cwd(),
    output: { file: 'dist/timcss.css', sourcemap: true, minify: true },
  })
  expect(typeof result.sourcemap).toBe('string')
  let parsed = JSON.parse(result.sourcemap!)
  expect(Array.isArray(parsed.sourcesContent)).toBe(true)
  expect(typeof parsed.sourcesContent[0]).toBe('string')
  expect(parsed.sourcesContent[0]).not.toBe(result.css)
  expect(parsed.sourcesContent[0]).toContain('\n')
  expect(parsed.sourcesContent[0].length).toBeGreaterThan(result.css.length)
})

test('build reports duplicate utility diagnostics from raw candidates', async () => {
  let result = await buildTimcssFromContent('<div class="px-page px-page py-section"></div>', {
    cwd: process.cwd(),
  })
  let duplicate = result.diagnostics.find((item) => item.code === 'TIM009' && item.className === 'px-page')
  expect(duplicate).toBeTruthy()
})

test('build can skip diagnostics and catalog enrichment for fast file output', async () => {
  let result = await buildTimcssFromContent('<div class="bg-surfacex px-page"></div>', { cwd: process.cwd() }, {
    includeDiagnostics: false,
    includeCatalogData: false,
  })
  expect(result.css).toContain('.px-page')
  expect(result.diagnostics).toHaveLength(0)
  expect(result.candidateMatches).toHaveLength(0)
  expect(result.catalog).toBeNull()
})
