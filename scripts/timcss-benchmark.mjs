import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runCommandSync } from './_shared/process.mjs'

const root = process.cwd()
const runner = path.resolve(root, 'scripts', 'run-timcss-cli.mjs')
const scannerBaselineScript = path.resolve(root, 'scripts', 'timcss-scanner-baseline.mjs')
const reportsDir = path.resolve(root, 'docs', 'benchmarks')
const reportJsonFile = path.resolve(reportsDir, 'timcss-benchmark-latest.json')
const reportMdFile = path.resolve(reportsDir, 'timcss-benchmark-latest.md')
const publicBaselineFile = path.resolve(reportsDir, 'public-benchmark-baseline.md')
const strict = process.argv.includes('--strict')
const runsFlagIndex = process.argv.findIndex((item) => item === '--runs')
const runs = runsFlagIndex >= 0 ? Math.max(1, Number(process.argv[runsFlagIndex + 1] ?? 5) || 5) : 5

function runCli(args, options = {}) {
  let result = runCommandSync(process.execPath, [runner, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture === false ? 'inherit' : 'pipe',
    formatError: ({ status, result }) =>
      `Command failed (${status}): timcss ${args.join(' ')}\n${result.stderr ?? ''}`.trim(),
  })
  return result.stdout ?? ''
}

function runNodeScript(scriptFile, args = []) {
  let result = runCommandSync(process.execPath, [scriptFile, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    formatError: ({ status }) =>
      `Command failed (${status}): node ${path.relative(root, scriptFile)} ${args.join(' ')}`.trim(),
  })
  return result.stdout ?? ''
}

function parseJsonFromOutput(raw) {
  let trimmed = raw.trim()
  if (!trimmed) throw new Error('Empty output, unable to parse JSON.')
  let marker = trimmed.lastIndexOf('\n{')
  if (marker >= 0) return JSON.parse(trimmed.slice(marker + 1))
  let first = trimmed.indexOf('{')
  if (first >= 0) return JSON.parse(trimmed.slice(first))
  throw new Error(`No JSON payload found in output.\n${trimmed}`)
}

function percentile(values, ratio) {
  if (values.length === 0) return 0
  let sorted = [...values].sort((a, b) => a - b)
  let index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

function summarizeTimings(values) {
  let total = values.reduce((sum, item) => sum + item, 0)
  return {
    runs: values.length,
    minMs: Number(Math.min(...values).toFixed(2)),
    meanMs: Number((total / values.length).toFixed(2)),
    p95Ms: Number(percentile(values, 0.95).toFixed(2)),
    maxMs: Number(Math.max(...values).toFixed(2)),
  }
}

function formatTimingSummary(name, summary) {
  return `- ${name}: mean=${summary.meanMs}ms p95=${summary.p95Ms}ms min=${summary.minMs}ms max=${summary.maxMs}ms`
}

function measureRuns(loopCount, execute) {
  let timings = []
  let payload
  for (let i = 0; i < loopCount; i++) {
    let start = process.hrtime.bigint()
    payload = execute()
    let elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000
    timings.push(elapsedMs)
  }
  return { summary: summarizeTimings(timings), lastPayload: payload }
}

function topClasses(payload, size) {
  let items = payload?.payload?.items ?? []
  return items.slice(0, size).map((item) => item.className)
}

function computeHit(expected, found) {
  return expected.some((item) => found.includes(item))
}

function renderMarkdown(report) {
  let lines = []
  lines.push('# TimCSS Benchmark Latest')
  lines.push('')
  lines.push(`- checkedAt: ${report.checkedAt}`)
  lines.push(`- strict: ${report.strict}`)
  lines.push(`- ok: ${report.ok}`)
  lines.push(`- runs: ${report.runs}`)
  lines.push(`- node: ${report.environment.node}`)
  lines.push(`- platform: ${report.environment.platform}`)
  lines.push('')
  lines.push('## Performance')
  lines.push('')
  lines.push(formatTimingSummary('inspect.wechat', report.timings.inspectWechat))
  lines.push(formatTimingSummary('build.wechat', report.timings.buildWechat))
  lines.push(formatTimingSummary('catalog.query', report.timings.catalogQuery))
  lines.push(formatTimingSummary('catalog.intent', report.timings.catalogIntent))
  lines.push('')
  lines.push('## Retrieval Quality')
  lines.push('')
  lines.push(`- hit@3: ${(report.quality.retrieval.hitAt3 * 100).toFixed(2)}%`)
  lines.push(`- hit@5: ${(report.quality.retrieval.hitAt5 * 100).toFixed(2)}%`)
  lines.push(`- cases: ${report.quality.retrieval.cases.length}`)
  lines.push('')
  lines.push('## Scanner Accuracy')
  lines.push('')
  lines.push(`- missing tokens: ${report.quality.scanner.missingTokens}`)
  lines.push(`- absent violations: ${report.quality.scanner.absentViolations}`)
  lines.push(`- miss rate: ${(report.quality.scanner.missRate * 100).toFixed(2)}%`)
  lines.push('')
  lines.push('## Build Artifact')
  lines.push('')
  lines.push(`- css bytes: ${report.artifacts.wechatCssBytes}`)
  lines.push(`- output: ${report.artifacts.wechatCssFile}`)
  lines.push('')
  return lines.join('\n') + '\n'
}

function renderPublicBaselineMarkdown(report) {
  let lines = []
  lines.push('# TimCSS 公开基准（当前基线）')
  lines.push('')
  lines.push(`- 日期：${report.checkedAt}`)
  lines.push(`- 环境：${report.environment.node} / ${report.environment.platform}`)
  lines.push(`- 严格模式：${report.strict}`)
  lines.push(`- 结果：${report.ok ? '通过' : '未通过'}`)
  lines.push('')
  lines.push('| 指标 | 当前值 | 说明 |')
  lines.push('| --- | --- | --- |')
  lines.push(`| 编译速度（build mean） | ${report.timings.buildWechat.meanMs}ms | 微信示例 build 平均耗时 |`)
  lines.push(`| 产物体积（wechat css） | ${report.artifacts.wechatCssBytes} bytes | 产物体积越小越利于端侧加载 |`)
  lines.push(`| 扫描准确率（miss rate） | ${(report.quality.scanner.missRate * 100).toFixed(2)}% | 基于 scanner baseline fixtures |`)
  lines.push(`| 文档检索成功率（hit@3） | ${(report.quality.retrieval.hitAt3 * 100).toFixed(2)}% | 3 条结果内命中目标类 |`)
  lines.push('')
  lines.push(
    '> 说明：这份报告用于公开透明地展示 TimCSS 当前基线。竞品结论请结合 `competitor-scorecard-latest.md` 一起阅读，其中受限项会明确标注，不把 `N/A` 伪装成已完成实测。',
  )
  lines.push('')
  return lines.join('\n') + '\n'
}

async function main() {
  let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-benchmark-'))
  let wechatCssFile = path.join(tempDir, 'timcss-wechat.css')

  try {
    // Warm-up once to avoid counting first-run prepare/build overhead in benchmark loops.
    runCli(['inspect', '--config', 'examples/wechat-miniapp/timcss.config.json', '--json'])
    runCli(['catalog', '--query', 'safe', '--json'])
    runCli(['catalog', '--intent', '底部安全区 吸底区域', '--platform', 'wechat-miniprogram', '--json'])

    let inspectWechat = measureRuns(runs, () =>
      parseJsonFromOutput(runCli(['inspect', '--config', 'examples/wechat-miniapp/timcss.config.json', '--json'])),
    )

    let buildWechat = measureRuns(runs, () =>
      runCli([
        'build',
        '--config',
        'examples/wechat-miniapp/timcss.config.json',
        '--out',
        wechatCssFile,
      ]),
    )

    let catalogQuery = measureRuns(runs, () =>
      parseJsonFromOutput(runCli(['catalog', '--query', 'safe', '--json'])),
    )

    let catalogIntent = measureRuns(runs, () =>
      parseJsonFromOutput(
        runCli(['catalog', '--intent', '底部安全区 吸底区域', '--platform', 'wechat-miniprogram', '--json']),
      ),
    )

    let scannerBaseline = parseJsonFromOutput(runNodeScript(scannerBaselineScript, ['--json']))

    let cssBytes = (await fs.stat(wechatCssFile)).size

    let retrievalCases = [
      { query: '底部安全区', expected: ['pb-safe', 'pb-tabbar-safe'] },
      { query: '卡片圆角', expected: ['rounded-card'] },
      { query: '按压状态', expected: ['pressed:'] },
      { query: '按钮高度', expected: ['h-control', 'h-control-lg'] },
      { query: '发丝线', expected: ['hairline', 'hairline-b'] },
    ]

    let retrievalDetails = retrievalCases.map((entry) => {
      let result = parseJsonFromOutput(runCli(['catalog', '--intent', entry.query, '--json']))
      let top3 = topClasses(result, 3)
      let top5 = topClasses(result, 5)
      return {
        ...entry,
        top3,
        top5,
        hitAt3: computeHit(entry.expected, top3),
        hitAt5: computeHit(entry.expected, top5),
      }
    })

    let hitAt3 = retrievalDetails.filter((item) => item.hitAt3).length / retrievalDetails.length
    let hitAt5 = retrievalDetails.filter((item) => item.hitAt5).length / retrievalDetails.length

    let thresholds = {
      minHitAt3: 0.8,
      maxInspectMeanMs: 4000,
      maxBuildMeanMs: 5000,
    }

    let strictOk =
      hitAt3 >= thresholds.minHitAt3 &&
      inspectWechat.summary.meanMs <= thresholds.maxInspectMeanMs &&
      buildWechat.summary.meanMs <= thresholds.maxBuildMeanMs &&
      scannerBaseline.missRate === 0 &&
      scannerBaseline.absentViolations === 0
    let ok = cssBytes > 0 && (strict ? strictOk : true)

    let report = {
      ok,
      strict,
      checkedAt: new Date().toISOString(),
      runs,
      environment: {
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
      },
      catalog: inspectWechat.lastPayload?.payload?.catalog ?? catalogIntent.lastPayload?.payload?.catalog ?? null,
      thresholds,
      timings: {
        inspectWechat: inspectWechat.summary,
        buildWechat: buildWechat.summary,
        catalogQuery: catalogQuery.summary,
        catalogIntent: catalogIntent.summary,
      },
      quality: {
        scanner: {
          fixtures: scannerBaseline.fixtures,
          expectedTokens: scannerBaseline.expectedTokens,
          missingTokens: scannerBaseline.missingTokens,
          absentViolations: scannerBaseline.absentViolations,
          missRate: scannerBaseline.missRate,
        },
        retrieval: {
          hitAt3,
          hitAt5,
          cases: retrievalDetails,
        },
      },
      artifacts: {
        wechatCssBytes: cssBytes,
        wechatCssFile,
      },
      snapshots: {
        inspectCandidates: inspectWechat.lastPayload.payload?.candidates?.length ?? 0,
        inspectDiagnostics: inspectWechat.lastPayload.payload?.diagnostics?.length ?? 0,
        intentTop5: topClasses(catalogIntent.lastPayload, 5),
      },
    }

    await fs.mkdir(reportsDir, { recursive: true })
    await fs.writeFile(reportJsonFile, JSON.stringify(report, null, 2) + '\n', 'utf8')
    await fs.writeFile(reportMdFile, renderMarkdown(report), 'utf8')
    await fs.writeFile(publicBaselineFile, renderPublicBaselineMarkdown(report), 'utf8')

    process.stdout.write(
      [
        'TimCSS benchmark',
        `  ok: ${report.ok}`,
        `  strict: ${report.strict}`,
        `  report: ${path.relative(root, reportJsonFile)}`,
        `  markdown: ${path.relative(root, reportMdFile)}`,
        '',
        'Performance',
        formatTimingSummary('inspect.wechat', inspectWechat.summary),
        formatTimingSummary('build.wechat', buildWechat.summary),
        formatTimingSummary('catalog.query', catalogQuery.summary),
        formatTimingSummary('catalog.intent', catalogIntent.summary),
        '',
        'Retrieval',
        `- hit@3: ${(hitAt3 * 100).toFixed(2)}%`,
        `- hit@5: ${(hitAt5 * 100).toFixed(2)}%`,
        '',
        'Scanner',
        `- missing tokens: ${scannerBaseline.missingTokens}`,
        `- miss rate: ${(scannerBaseline.missRate * 100).toFixed(2)}%`,
      ].join('\n') + '\n',
    )

    process.exitCode = report.ok ? 0 : 1
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
