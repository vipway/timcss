import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { beforeAll, expect, test } from 'vitest'

const workspaceRoot = path.resolve(process.cwd())
const runner = path.resolve(workspaceRoot, 'scripts/run-timcss-cli.mjs')

function runNodeCommand(command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
}

function runCli(args: string[]) {
  return runNodeCommand(process.execPath, [runner, ...args])
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 10000, intervalMs = 50) {
  let startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await predicate()) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Timed out after ${timeoutMs}ms`)
}

beforeAll(
  () => {
    let prepared = runNodeCommand('pnpm', ['run', 'timcss:prepare'])
    expect(prepared.status).toBe(0)
  },
  120_000,
)

test(
  'inspect command returns JSON envelope with metadata matches',
  () => {
    let result = runCli(['inspect', '--config', 'examples/wechat-miniapp/timcss.config.json', '--json'])
    expect(result.status).toBe(0)
    let json = JSON.parse(result.stdout)
    expect(json.tool).toBe('timcss')
    expect(json.command).toBe('inspect')
    expect(Array.isArray(json.payload.candidateMatches)).toBe(true)
    expect(json.payload.candidateMatches.some((item: { candidate: string }) => item.candidate === 'tm-px-page')).toBe(true)
  },
  120_000,
)

test(
  'inspect command works when CLI dist entry is invoked through a symlinked path',
  async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-cli-symlink-'))
    try {
      let linkedEntry = path.join(tempDir, 'timcss-linked.mjs')
      await fs.symlink(path.join(workspaceRoot, 'packages', 'timcss-cli', 'dist', 'index.js'), linkedEntry)
      let result = runNodeCommand(process.execPath, [
        linkedEntry,
        'inspect',
        '--config',
        'examples/wechat-miniapp/timcss.config.json',
        '--json',
      ])
      expect(result.status).toBe(0)
      let json = JSON.parse(result.stdout)
      expect(json.command).toBe('inspect')
      expect(Array.isArray(json.payload.candidates)).toBe(true)
      expect(json.payload.candidates.length).toBeGreaterThan(0)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  },
  120_000,
)

test(
  'build command writes css and sourcemap files when output.sourcemap is enabled',
  async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-cli-test-'))
    try {
      let outputFile = path.join(tempDir, 'timcss.css')
      let configFile = path.join(tempDir, 'timcss.config.json')

      await fs.writeFile(
        configFile,
        JSON.stringify(
          {
            cwd: workspaceRoot,
            platform: 'mobile',
            content: ['examples/react-mobile/src/**/*.{tsx,jsx,html}'],
            diagnostics: { enabled: true, level: 'info', output: 'pretty' },
            output: { file: outputFile, minify: true, sourcemap: true },
          },
          null,
          2,
        ),
        'utf8',
      )

      let result = runCli(['build', '--config', configFile])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain(`Built ${outputFile}`)
      expect(result.stdout).toContain(`${outputFile}.map`)

      let css = await fs.readFile(outputFile, 'utf8')
      let map = await fs.readFile(`${outputFile}.map`, 'utf8')
      expect(css).toContain('sourceMappingURL=timcss.css.map')
      expect(map).toContain('"version":3')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  },
  120_000,
)

test(
  'build command resolves relative output.file against external config directory',
  async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-cli-external-config-'))
    let outputRelative = `dist/${path.basename(tempDir)}.css`
    let externalOutputFile = path.join(tempDir, outputRelative)
    let workspaceLeakFile = path.join(workspaceRoot, outputRelative)
    try {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
      await fs.writeFile(path.join(tempDir, 'src', 'index.html'), '<div class="px-page bg-primary"></div>', 'utf8')

      let configFile = path.join(tempDir, 'timcss.config.json')
      await fs.writeFile(
        configFile,
        JSON.stringify(
          {
            platform: 'mobile',
            content: ['src/**/*.html'],
            output: { file: outputRelative, minify: true },
          },
          null,
          2,
        ),
        'utf8',
      )

      let result = runCli(['build', '--config', configFile])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain(`Built ${externalOutputFile}`)

      let css = await fs.readFile(externalOutputFile, 'utf8')
      expect(css).toContain('.px-page')
      expect(css).toContain('.bg-primary')

      let workspaceLeakExists = await fs
        .access(workspaceLeakFile)
        .then(() => true)
        .catch(() => false)
      expect(workspaceLeakExists).toBe(false)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
      await fs.rm(workspaceLeakFile, { force: true })
      await fs.rm(`${workspaceLeakFile}.map`, { force: true })
    }
  },
  120_000,
)

test(
  'build command writes shared and entry wxss files for wechat split output',
  async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-cli-split-'))
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

      let configFile = path.join(tempDir, 'timcss.config.json')
      await fs.writeFile(
        configFile,
        JSON.stringify(
          {
            cwd: tempDir,
            platform: 'wechat-miniprogram',
            prefix: 'tm',
            content: ['src/**/*.wxml'],
            diagnostics: { enabled: true, level: 'info', output: 'pretty' },
            output: { dir: 'dist', minify: false },
          },
          null,
          2,
        ),
        'utf8',
      )

      let result = runCli(['build', '--config', configFile])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Built 3 assets')

      let sharedCss = await fs.readFile(path.join(tempDir, 'dist', 'app.wxss'), 'utf8')
      let homeCss = await fs.readFile(path.join(tempDir, 'dist', 'pages', 'home.wxss'), 'utf8')
      let profileCss = await fs.readFile(path.join(tempDir, 'dist', 'pages', 'profile.wxss'), 'utf8')

      expect(sharedCss).toContain('.tm-px-page {')
      expect(homeCss).toContain('@import "../app.wxss";')
      expect(homeCss).toContain('.tm-bg-primary {')
      expect(homeCss).not.toContain('.tm-px-page')
      expect(profileCss).toContain('@import "../app.wxss";')
      expect(profileCss).toContain('.tm-text-primary {')
      expect(profileCss).not.toContain('.tm-px-page')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  },
  120_000,
)

test(
  'wechat split build cleans stale generated shared files',
  async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-cli-clean-'))
    try {
      await fs.mkdir(path.join(tempDir, 'src', 'pages'), { recursive: true })
      let configFile = path.join(tempDir, 'timcss.config.json')
      await fs.writeFile(
        configFile,
        JSON.stringify(
          {
            cwd: tempDir,
            platform: 'wechat-miniprogram',
            prefix: 'tm',
            content: ['src/**/*.wxml'],
            output: { dir: 'dist', minify: false },
          },
          null,
          2,
        ),
        'utf8',
      )

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

      let first = runCli(['build', '--config', configFile])
      expect(first.status).toBe(0)
      expect(await fs.readFile(path.join(tempDir, 'dist', 'app.wxss'), 'utf8')).toContain('.tm-px-page')

      await fs.rm(path.join(tempDir, 'src', 'pages', 'profile.wxml'))
      let second = runCli(['build', '--config', configFile])
      expect(second.status).toBe(0)

      let sharedExists = await fs
        .access(path.join(tempDir, 'dist', 'app.wxss'))
        .then(() => true)
        .catch(() => false)
      expect(sharedExists).toBe(false)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  },
  120_000,
)

test(
  'build command respects configured output entries',
  async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-cli-entry-groups-'))
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

      let configFile = path.join(tempDir, 'timcss.config.json')
      await fs.writeFile(
        configFile,
        JSON.stringify(
          {
            cwd: tempDir,
            platform: 'wechat-miniprogram',
            prefix: 'tm',
            content: ['src/**/*.wxml'],
            output: {
              mode: 'per-entry',
              dir: 'dist',
              minify: false,
              entries: [
                { name: 'home', include: ['src/pages/home/**/*.wxml'], outputFile: 'bundle/home.wxss' },
                { name: 'profile', include: ['src/pages/profile/**/*.wxml'], outputFile: 'bundle/profile.wxss' },
              ],
            },
          },
          null,
          2,
        ),
        'utf8',
      )

      let result = runCli(['build', '--config', configFile])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('bundle/home.wxss')
      expect(result.stdout).toContain('bundle/profile.wxss')

      let homeCss = await fs.readFile(path.join(tempDir, 'dist', 'bundle', 'home.wxss'), 'utf8')
      let profileCss = await fs.readFile(path.join(tempDir, 'dist', 'bundle', 'profile.wxss'), 'utf8')
      expect(homeCss).toContain('.tm-bg-primary {')
      expect(profileCss).toContain('.tm-text-primary {')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  },
  120_000,
)

test(
  'dev command rebuilds wxss after wxml change',
  async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-cli-dev-'))
    let child: ReturnType<typeof spawn> | null = null
    try {
      await fs.mkdir(path.join(tempDir, 'src', 'pages', 'index'), { recursive: true })
      await fs.writeFile(
        path.join(tempDir, 'src', 'pages', 'index', 'index.wxml'),
        '<view class="tm-px-page tm-bg-primary"></view>',
        'utf8',
      )

      let configFile = path.join(tempDir, 'timcss.config.json')
      await fs.writeFile(
        configFile,
        JSON.stringify(
          {
            cwd: tempDir,
            platform: 'wechat-miniprogram',
            prefix: 'tm',
            content: ['src/**/*.wxml'],
            output: { dir: 'dist', minify: false },
          },
          null,
          2,
        ),
        'utf8',
      )

      child = spawn(process.execPath, [runner, 'dev', '--config', configFile, '--debounce', '20', '--watch-backend', 'polling', '--poll-interval', '50'], {
        cwd: workspaceRoot,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      if (!child.stdout || !child.stderr) throw new Error('Expected child stdio to be piped')

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk)
      })
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk)
      })

      await waitFor(async () => stdout.includes('[timcss:dev] watching'))

      let outputFile = path.join(tempDir, 'dist', 'pages', 'index', 'index.wxss')
      await waitFor(async () => (await fs.readFile(outputFile, 'utf8')).includes('.tm-bg-primary'))

      await fs.writeFile(
        path.join(tempDir, 'src', 'pages', 'index', 'index.wxml'),
        '<view class="tm-px-page tm-bg-primary tm-hairline"></view>',
        'utf8',
      )

      await waitFor(async () => {
        let css = await fs.readFile(outputFile, 'utf8')
        return css.includes('.tm-hairline')
      })

      expect(stderr).toBe('')
      expect(stdout).toContain('initial build')
      expect(stdout).toContain('rebuilt')
      expect(stdout).toContain('via polling')
    } finally {
      if (child && !child.killed) child.kill('SIGTERM')
      if (child) await new Promise((resolve) => child!.once('exit', resolve))
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  },
  120_000,
)

test('unknown command returns non-zero exit code', () => {
  let result = runCli(['unknown-command'])
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('Unknown TimCSS command')
})

test('catalog supports intent query from CLI', () => {
  let result = runCli(['catalog', '--intent', '底部安全区', '--platform', 'wechat-miniprogram', '--json'])
  expect(result.status).toBe(0)
  let json = JSON.parse(result.stdout)
  expect(json.command).toBe('catalog')
  expect(json.payload.filters.intent).toBe('底部安全区')
  expect(Array.isArray(json.payload.items)).toBe(true)
  expect(json.payload.items.some((item: { className: string }) => item.className === 'pb-safe' || item.className === 'pb-tabbar-safe')).toBe(true)
})
