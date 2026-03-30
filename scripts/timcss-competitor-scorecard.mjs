import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readJson } from './_shared/fs.mjs'
import { runCommandSync } from './_shared/process.mjs'

const root = process.cwd()
const runner = path.resolve(root, 'scripts', 'run-timcss-cli.mjs')
const timcssBenchmarkFile = path.resolve(root, 'docs', 'benchmarks', 'timcss-benchmark-latest.json')
const timcssPackageFile = path.resolve(root, 'packages', 'timcss-core', 'package.json')
const outJson = path.resolve(root, 'docs', 'benchmarks', 'competitor-scorecard-latest.json')
const outMd = path.resolve(root, 'docs', 'benchmarks', 'competitor-scorecard-latest.md')

const runsFlagIndex = process.argv.findIndex((item) => item === '--runs')
const runs = runsFlagIndex >= 0 ? Math.max(1, Number(process.argv[runsFlagIndex + 1] ?? 5) || 5) : 5

function runTimcssCli(args) {
  let result = runCommandSync(process.execPath, [runner, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    formatError: ({ status, result }) =>
      `Command failed (${status}): timcss ${args.join(' ')}\n${result.stderr ?? ''}`.trim(),
  })
  return result.stdout ?? ''
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

function renderScorecardMarkdown(report) {
  let lines = []
  lines.push('# TimCSS 竞品对照评分卡（最新，含受限项说明）')
  lines.push('')
  lines.push('## 1. 基础信息')
  lines.push('')
  lines.push(`- 对比日期：${report.checkedAt}`)
  lines.push(`- 测试环境：${report.environment.node} / ${report.environment.platform}`)
  lines.push(`- TimCSS 版本：${report.timcss.version}`)
  lines.push(`- 竞品对象：${report.competitor.name}`)
  lines.push(`- 竞品版本：${report.competitor.version}`)
  lines.push(`- 场景仓库：${report.scenario}`)
  lines.push(`- 对照方法：${report.methodology}`)
  lines.push('')
  lines.push('## 2. 维度与评分')
  lines.push('')
  lines.push('| 维度 | TimCSS | 竞品 A | 说明 |')
  lines.push('| --- | --- | --- | --- |')
  lines.push(`| 编译性能（build mean/p95） | ${report.timcss.build.meanMs}ms / ${report.timcss.build.p95Ms}ms | ${report.competitor.build.meanMs}ms / ${report.competitor.build.p95Ms}ms | 同环境、同内容样本、共享编译路径 |`)
  lines.push(`| 产物体积（css bytes） | ${report.timcss.cssBytes} | ${report.competitor.cssBytes} | 同样本构建输出体积 |`)
  lines.push(`| 扫描准确率（miss rate） | ${(report.timcss.scannerMissRate * 100).toFixed(2)}% | ${report.competitor.scannerMissRate === null ? 'N/A' : `${(report.competitor.scannerMissRate * 100).toFixed(2)}%`} | 竞品扫描器在本环境因缺少 cargo 无法构建 |`)
  lines.push(`| 文档检索成功率（hit@3） | ${(report.timcss.retrievalHitAt3 * 100).toFixed(2)}% | ${report.competitor.retrievalHitAt3 === null ? 'N/A' : `${(report.competitor.retrievalHitAt3 * 100).toFixed(2)}%`} | 竞品无同口径 intent/catalog 接口 |`)
  lines.push('')
  lines.push('## 3. 关键证据')
  lines.push('')
  lines.push(`- TimCSS 基准报告：\`docs/benchmarks/timcss-benchmark-latest.json\``)
  lines.push(`- 竞品对照报告：\`docs/benchmarks/competitor-scorecard-latest.json\``)
  lines.push(`- 对照脚本：\`scripts/timcss-competitor-scorecard.mjs\``)
  lines.push('')
  lines.push('## 4. 结论')
  lines.push('')
  lines.push('- 当前已完成可同口径执行指标的实测填充（编译性能、产物体积），并明确保留受限项说明。')
  lines.push('- 当前竞品 A 是“共享编译路径下的 Tailwind core 风格基线”，不等同于官方 Tailwind CLI 的全链路跑分。')
  lines.push('- 安装 Rust/cargo 并补齐官方扫描器后，可继续扩展扫描准确率等维度的正式对照。')
  lines.push('')
  return lines.join('\n') + '\n'
}

async function main() {
  let timcssBaseline = await readJson(timcssBenchmarkFile)
  let timcssPackage = await readJson(timcssPackageFile)
  let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-competitor-'))
  let competitorConfigFile = path.join(tempDir, 'tailwind-core-baseline.config.json')
  let competitorCssFile = path.join(tempDir, 'tailwind-core-baseline.css')

  try {
    await fs.writeFile(
      competitorConfigFile,
      JSON.stringify(
        {
          platform: 'wechat-miniprogram',
          content: ['examples/wechat-miniapp/src/pages/index/index.wxml'],
          diagnostics: { enabled: false, output: 'pretty' },
          variants: { enabled: false },
          presets: {
            mobile: { enabled: false },
            wechat: { enabled: false },
            recipes: { enabled: false },
          },
          output: { file: competitorCssFile, sourcemap: false },
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )

    runTimcssCli(['build', '--config', competitorConfigFile, '--out', competitorCssFile])

    let buildTimings = []
    for (let i = 0; i < runs; i++) {
      let start = process.hrtime.bigint()
      runTimcssCli(['build', '--config', competitorConfigFile, '--out', competitorCssFile])
      let elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000
      buildTimings.push(elapsedMs)
    }

    let competitorCssBytes = (await fs.stat(competitorCssFile)).size
    let report = {
      checkedAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
      },
      scope: 'partial-same-environment',
      methodology:
        '竞品 A 使用同一样本与同一 CLI 入口，在共享编译路径下关闭 TimCSS 预设与变体生成 Tailwind core 风格基线；无法同口径执行的指标会明确标记 N/A。',
      scenario: 'examples/wechat-miniapp/src/pages/index/index.wxml',
      timcss: {
        version: timcssBaseline.catalog?.packageVersion ?? timcssPackage.version,
        build: timcssBaseline.timings.buildWechat,
        cssBytes: timcssBaseline.artifacts.wechatCssBytes,
        scannerMissRate: timcssBaseline.quality.scanner.missRate,
        retrievalHitAt3: timcssBaseline.quality.retrieval.hitAt3,
      },
      competitor: {
        name: 'Tailwind CSS v4 Core-Style Baseline（shared compile path）',
        version: '4.2.1',
        build: summarizeTimings(buildTimings),
        cssBytes: competitorCssBytes,
        scannerMissRate: null,
        retrievalHitAt3: null,
        limitations: [
          '当前环境缺少 cargo，无法构建 Tailwind 官方 oxide 扫描器。',
          '竞品未提供与 TimCSS `catalog --intent` 对齐的语义检索接口。',
          '当前报告中的竞品 A 为共享编译路径下的 core 风格基线，不代表官方 CLI 的全部行为。',
        ],
      },
    }

    if (typeof report.timcss.version !== 'string' || report.timcss.version.length === 0) {
      throw new Error(`Invalid TimCSS version in ${path.relative(root, timcssPackageFile)}`)
    }

    await fs.writeFile(outJson, JSON.stringify(report, null, 2) + '\n', 'utf8')
    await fs.writeFile(outMd, renderScorecardMarkdown(report), 'utf8')

    process.stdout.write(
      [
        'TimCSS competitor scorecard',
        `  report: ${path.relative(root, outJson)}`,
        `  markdown: ${path.relative(root, outMd)}`,
        '',
        `TimCSS build mean/p95: ${report.timcss.build.meanMs}ms / ${report.timcss.build.p95Ms}ms`,
        `Competitor build mean/p95: ${report.competitor.build.meanMs}ms / ${report.competitor.build.p95Ms}ms`,
        `TimCSS css bytes: ${report.timcss.cssBytes}`,
        `Competitor css bytes: ${report.competitor.cssBytes}`,
      ].join('\n') + '\n',
    )
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
