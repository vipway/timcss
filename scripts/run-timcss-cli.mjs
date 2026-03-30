import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { pathExists, readJson } from './_shared/fs.mjs'
import { runCommandSync } from './_shared/process.mjs'
import { packageBuildTargets } from './timcss-build-targets.mjs'

const root = process.cwd()
const prepareManifestFile = path.resolve(root, '.timcss', 'prepare-manifest.json')

async function exists(file) {
  return pathExists(path.resolve(root, file))
}

async function loadPrepareManifest() {
  if (!(await exists(prepareManifestFile))) return null
  return readJson(prepareManifestFile)
}

async function hasStaleSourceWatchPath(watchPath, generatedAtMs) {
  let absolute = path.resolve(root, watchPath)
  if (!(await exists(absolute))) return true
  let stat = await fs.stat(absolute)
  return stat.mtimeMs > generatedAtMs
}

async function ensurePrepared() {
  let manifest = await loadPrepareManifest()
  if (!manifest || !Array.isArray(manifest.targets) || manifest.targets.length !== packageBuildTargets.length) {
    manifest = null
  }

  let staleTargets = []
  if (manifest) {
    for (let target of manifest.targets) {
      if (!(await exists(target.distFile))) {
        staleTargets.push(target.distFile)
        continue
      }
      for (let watchPath of target.watchPaths ?? []) {
        if (await hasStaleSourceWatchPath(watchPath, manifest.generatedAtMs)) {
          staleTargets.push(target.distFile)
          break
        }
      }
    }
  } else {
    staleTargets.push(...packageBuildTargets.map((target) => target.distFile))
  }

  if (staleTargets.length === 0) return

  runCommandSync('pnpm', ['run', 'timcss:prepare'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    exitOnFailure: true,
  })
}

async function main() {
  await ensurePrepared()
  let cliEntrypoint = path.resolve(root, 'packages/timcss-cli/dist/index.js')
  let { runTimcssCli } = await import(pathToFileURL(cliEntrypoint).href)
  let exitCode = await runTimcssCli(process.argv.slice(2))
  process.exitCode = exitCode ?? 0
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
