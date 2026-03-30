import fs from 'node:fs/promises'
import path from 'node:path'
import { packageBuildTargets } from './timcss-build-targets.mjs'

const root = process.cwd()
const manifestFile = path.resolve(root, '.timcss', 'prepare-manifest.json')

async function collectWatchPaths(dir) {
  let absolute = path.resolve(root, dir)
  let stat = await fs.stat(absolute)
  if (!stat.isDirectory()) return [dir]

  let watchPaths = [dir]
  let entries = await fs.readdir(absolute, { withFileTypes: true })
  for (let entry of entries) {
    let relative = path.join(dir, entry.name)
    if (entry.isDirectory()) watchPaths.push(...(await collectWatchPaths(relative)))
    else watchPaths.push(relative)
  }
  return watchPaths
}

async function main() {
  let generatedAtMs = Date.now()
  let targets = []

  for (let target of packageBuildTargets) {
    targets.push({
      sourceDir: target.sourceDir,
      distFile: target.distFile,
      watchPaths: await collectWatchPaths(target.sourceDir),
    })
  }

  let manifest = {
    version: 1,
    generatedAt: new Date(generatedAtMs).toISOString(),
    generatedAtMs,
    targets,
  }

  await fs.mkdir(path.dirname(manifestFile), { recursive: true })
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  process.stdout.write(`[timcss] wrote ${path.relative(root, manifestFile)}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
