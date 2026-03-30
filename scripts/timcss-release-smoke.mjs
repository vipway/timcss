import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathExists } from './_shared/fs.mjs'
import { runCommandSync } from './_shared/process.mjs'

const root = process.cwd()
const nodeRequire = createRequire(import.meta.url)

const packagesToPack = [
  'packages/timcss-core',
  'packages/timcss-tokens',
  'packages/timcss-preset-mobile',
  'packages/timcss-preset-wechat',
  'packages/timcss-variants',
  'packages/timcss-scanner',
  'packages/timcss-diagnostics',
  'packages/timcss-engine',
  'packages/timcss-cli',
]

function run(command, args, options = {}) {
  let result = runCommandSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    env: options.env,
    echoOutputOnFailure: options.capture,
    formatError: ({ status }) => `Command failed (${status}): ${[command, ...args].join(' ')}`,
  })

  return result
}

function parseCapturedJson(commandLabel, result) {
  let stdout = (result.stdout ?? '').trim()
  let stderr = (result.stderr ?? '').trim()
  if (!stdout) {
    throw new Error(
      `${commandLabel} produced no stdout.\nstdout: ${JSON.stringify(result.stdout ?? '')}\nstderr: ${JSON.stringify(result.stderr ?? '')}`,
    )
  }
  try {
    return JSON.parse(stdout)
  } catch (error) {
    throw new Error(
      `${commandLabel} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}\nstdout: ${stdout}\nstderr: ${stderr}`,
    )
  }
}

function ensurePrepared() {
  run('pnpm', ['run', 'timcss:prepare'])
}

async function packTarballs(packDir) {
  let tarballs = []
  for (let relDir of packagesToPack) {
    let cwd = path.resolve(root, relDir)
    let packed = run('pnpm', ['pack', '--pack-destination', packDir], { cwd, capture: true })
    let outputLines = (packed.stdout ?? '').trim().split(/\r?\n/).filter(Boolean)
    let tarball = outputLines[outputLines.length - 1]
    if (!tarball) throw new Error(`Unable to parse pack output for ${relDir}`)
    tarballs.push(path.resolve(packDir, tarball.trim()))
  }

  let tailwindPackageJson = nodeRequire.resolve('tailwindcss/package.json', {
    paths: [path.resolve(root, 'packages', 'timcss-engine')],
  })
  let tailwindDir = path.dirname(tailwindPackageJson)
  let packedTailwind = run('npm', ['pack', tailwindDir, '--pack-destination', packDir], {
    capture: true,
    env: { NPM_CONFIG_CACHE: path.join(os.tmpdir(), 'timcss-npm-cache') },
  })
  let packedTailwindLines = (packedTailwind.stdout ?? '').trim().split(/\r?\n/).filter(Boolean)
  let tailwindTarball = packedTailwindLines[packedTailwindLines.length - 1]
  if (!tailwindTarball) throw new Error('Unable to parse pack output for official tailwindcss dependency')
  tarballs.push(path.resolve(packDir, tailwindTarball.trim()))

  return tarballs
}

async function createSmokeProject(projectDir) {
  await fs.mkdir(path.join(projectDir, 'src', 'pages', 'index'), { recursive: true })
  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(
      {
        name: 'timcss-release-smoke',
        private: true,
        version: '0.0.0',
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )

  await fs.writeFile(
    path.join(projectDir, 'timcss.config.json'),
    JSON.stringify(
      {
        platform: 'wechat-miniprogram',
        prefix: 'tm',
        content: ['src/**/*.wxml'],
        diagnostics: { enabled: true, level: 'info', output: 'pretty' },
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )

  await fs.writeFile(
    path.join(projectDir, 'src', 'pages', 'index', 'index.wxml'),
    `<view class="tm-px-page tm-py-section tm-pb-safe tm-hairline-b tm-pressed:opacity-80">TimCSS smoke</view>\n`,
    'utf8',
  )
}

async function assertExists(file) {
  try {
    await fs.access(file)
  } catch {
    throw new Error(`Expected file missing: ${file}`)
  }
}

async function runSmoke(projectDir) {
  let cliEntrypoint = path.resolve(projectDir, 'node_modules', '@timcss', 'cli', 'dist', 'index.js')
  let configFile = path.resolve(projectDir, 'timcss.config.json')
  let outsideCwd = path.dirname(projectDir)
  let inspect = run(process.execPath, [cliEntrypoint, 'inspect', '--config', configFile, '--json'], {
    cwd: outsideCwd,
    capture: true,
  })
  let inspectJson = parseCapturedJson('timcss inspect --json', inspect)
  if (inspectJson.command !== 'inspect') {
    throw new Error('Unexpected inspect output: command is not inspect')
  }
  if (!Array.isArray(inspectJson.payload?.candidates) || inspectJson.payload.candidates.length === 0) {
    throw new Error('Inspect output contains no candidates')
  }

  run(process.execPath, [cliEntrypoint, 'build', '--config', configFile], { cwd: outsideCwd })
  let entryFile = path.resolve(projectDir, 'dist', 'pages', 'index', 'index.wxss')
  let singleCssFile = path.resolve(projectDir, 'dist', 'timcss.css')
  let outsideEntryFile = path.resolve(outsideCwd, 'dist', 'pages', 'index', 'index.wxss')
  await assertExists(entryFile)

  let entryCss = await fs.readFile(entryFile, 'utf8')
  if (!entryCss.includes('.tm-px-page') || !entryCss.includes('.tm-hairline-b')) {
    throw new Error('Built entry WXSS is missing expected TimCSS utilities')
  }

  if (await pathExists(singleCssFile)) {
    throw new Error('Wechat smoke build unexpectedly produced legacy single-file CSS output')
  }

  if (await pathExists(outsideEntryFile)) {
    throw new Error('Wechat smoke build wrote artifacts relative to the invoking cwd instead of the config project')
  }
}

async function main() {
  let keepTemp = process.argv.includes('--keep-temp')
  let packDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-pack-'))
  let projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-smoke-'))

  try {
    ensurePrepared()
    let tarballs = await packTarballs(packDir)
    await createSmokeProject(projectDir)

    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', ...tarballs], {
      cwd: projectDir,
      env: { NPM_CONFIG_CACHE: path.join(os.tmpdir(), 'timcss-npm-cache') },
    })

    await runSmoke(projectDir)

    process.stdout.write(
      `TimCSS release smoke\n  ok: true\n  package tarballs: ${tarballs.length}\n  packDir: ${packDir}\n  projectDir: ${projectDir}\n`,
    )
  } finally {
    if (!keepTemp) {
      await fs.rm(packDir, { recursive: true, force: true })
      await fs.rm(projectDir, { recursive: true, force: true })
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
