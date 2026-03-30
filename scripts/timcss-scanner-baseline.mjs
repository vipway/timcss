import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { pathExists } from './_shared/fs.mjs'
import { runCommandSync } from './_shared/process.mjs'

const root = process.cwd()
const scannerDist = path.resolve(root, 'packages/timcss-scanner/dist/index.js')
const fixtureModule = pathToFileURL(path.resolve(root, 'packages/timcss-scanner/tests/fixtures/baseline-fixtures.mjs')).href

function ensurePrepared() {
  runCommandSync('pnpm', ['run', 'timcss:prepare'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    exitOnFailure: true,
  })
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`
}

async function main() {
  if (!(await pathExists(scannerDist))) ensurePrepared()

  let scannerModule = await import(pathToFileURL(scannerDist).href)
  let fixturesModule = await import(fixtureModule)
  let adapters = scannerModule.DEFAULT_ADAPTERS
  let fixtures = fixturesModule.baselineFixtures

  let reportCases = []
  let byAdapter = new Map()

  for (let fixture of fixtures) {
    let adapter = adapters.find((item) => item.name === fixture.adapter)
    if (!adapter) {
      reportCases.push({
        name: fixture.name,
        adapter: fixture.adapter,
        expected: fixture.expected.length,
        extracted: 0,
        missing: fixture.expected,
        absentViolations: [],
        missRate: 1,
      })
      continue
    }

    let extracted = adapter.extractCandidates(fixture.code)
    let missing = fixture.expected.filter((token) => !extracted.includes(token))
    let absentViolations = (fixture.absent ?? []).filter((token) => extracted.includes(token))
    let missRate = fixture.expected.length === 0 ? 0 : missing.length / fixture.expected.length

    reportCases.push({
      name: fixture.name,
      adapter: fixture.adapter,
      expected: fixture.expected.length,
      extracted: fixture.expected.length - missing.length,
      missing,
      absentViolations,
      missRate,
    })

    let stats = byAdapter.get(fixture.adapter) ?? { cases: 0, expected: 0, missing: 0 }
    stats.cases += 1
    stats.expected += fixture.expected.length
    stats.missing += missing.length
    byAdapter.set(fixture.adapter, stats)
  }

  let adapterSummary = [...byAdapter.entries()].map(([name, stats]) => ({
    adapter: name,
    cases: stats.cases,
    expected: stats.expected,
    missing: stats.missing,
    missRate: stats.expected === 0 ? 0 : stats.missing / stats.expected,
  }))

  let totalExpected = reportCases.reduce((sum, item) => sum + item.expected, 0)
  let totalMissing = reportCases.reduce((sum, item) => sum + item.missing.length, 0)
  let totalAbsentViolations = reportCases.reduce((sum, item) => sum + item.absentViolations.length, 0)
  let ok = totalMissing === 0 && totalAbsentViolations === 0

  let payload = {
    ok,
    checkedAt: new Date().toISOString(),
    fixtures: reportCases.length,
    expectedTokens: totalExpected,
    missingTokens: totalMissing,
    absentViolations: totalAbsentViolations,
    missRate: totalExpected === 0 ? 0 : totalMissing / totalExpected,
    adapters: adapterSummary,
    cases: reportCases,
  }

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n')
  } else {
    process.stdout.write(
      `TimCSS scanner baseline\n  ok: ${payload.ok}\n  fixtures: ${payload.fixtures}\n  expected tokens: ${payload.expectedTokens}\n  missing tokens: ${payload.missingTokens}\n  absent violations: ${payload.absentViolations}\n  miss rate: ${formatPercent(payload.missRate)}\n`,
    )
    process.stdout.write('\nAdapter summary\n')
    for (let item of adapterSummary) {
      process.stdout.write(
        `- ${item.adapter}: cases=${item.cases} expected=${item.expected} missing=${item.missing} missRate=${formatPercent(item.missRate)}\n`,
      )
    }
    if (!ok) {
      process.stdout.write('\nCase details\n')
      for (let item of reportCases) {
        if (item.missing.length === 0 && item.absentViolations.length === 0) continue
        process.stdout.write(`- ${item.name} (${item.adapter})\n`)
        if (item.missing.length > 0) process.stdout.write(`  missing: ${item.missing.join(', ')}\n`)
        if (item.absentViolations.length > 0) process.stdout.write(`  absent violations: ${item.absentViolations.join(', ')}\n`)
      }
    }
  }

  process.exitCode = ok ? 0 : 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
