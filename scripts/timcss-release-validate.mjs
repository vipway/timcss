import path from 'node:path'
import { pathExists, readJson } from './_shared/fs.mjs'

const root = process.cwd()

const requiredPackages = [
  'timcss-core',
  'timcss-tokens',
  'timcss-preset-mobile',
  'timcss-preset-wechat',
  'timcss-variants',
  'timcss-scanner',
  'timcss-diagnostics',
  'timcss-engine',
  'timcss-cli',
]

const requiredDocs = [
  'docs/README.md',
  'docs/start-here.md',
  'docs/integration-h5.md',
  'docs/integration-wechat-miniapp.md',
  'docs/integration-taro-uniapp.md',
  'docs/faq.md',
  'docs/release-preflight-checklist.md',
  'docs/local-development.md',
  'docs/examples-guide.md',
  'docs/release-announcement.md',
  'docs/cli-json-contracts.md',
  'docs/search-cheatsheet.md',
  'docs/timcss-product-architecture.md',
  'docs/benchmarks/README.md',
  'docs/benchmarks/competitor-scorecard-template.md',
  'docs/benchmarks/competitor-scorecard-latest.md',
  'docs/benchmarks/competitor-scorecard-latest.json',
  'docs/benchmarks/public-benchmark-baseline.md',
  'docs/atomic-utilities-index.md',
  'docs/atomic-utilities-index.json',
]

const requiredExamples = ['examples/wechat-miniapp', 'examples/react-mobile']
const requiredRootScripts = [
  'typecheck',
  'timcss:prepare',
  'timcss:typecheck',
  'timcss:test',
  'timcss:build',
  'timcss:inspect',
  'timcss:doctor',
  'timcss:print-entry',
  'timcss:catalog',
  'timcss:docs:generate',
  'timcss:docs:build',
  'timcss:benchmark',
  'timcss:benchmark:strict',
  'timcss:competitor:scorecard',
  'timcss:scanner:baseline',
  'timcss:release:smoke',
  'timcss:release:validate',
  'timcss:example:wechat:build',
  'timcss:example:wechat:inspect',
  'timcss:example:wechat:doctor',
  'timcss:example:react:build',
  'timcss:example:react:inspect',
  'timcss:example:react:doctor',
]

const rootScriptContracts = [
  {
    name: 'timcss:build',
    include: ['run-timcss-cli.mjs build'],
    exclude: ['--filter @timcss/cli build'],
  },
  {
    name: 'timcss:inspect',
    include: ['run-timcss-cli.mjs inspect'],
    exclude: ['--filter @timcss/cli inspect'],
  },
  {
    name: 'timcss:doctor',
    include: ['run-timcss-cli.mjs doctor'],
    exclude: ['--filter @timcss/cli doctor'],
  },
  {
    name: 'timcss:print-entry',
    include: ['run-timcss-cli.mjs print-entry'],
    exclude: [],
  },
  {
    name: 'timcss:catalog',
    include: ['run-timcss-cli.mjs catalog'],
    exclude: [],
  },
  {
    name: 'timcss:scanner:baseline',
    include: ['timcss-scanner-baseline.mjs'],
    exclude: [],
  },
  {
    name: 'timcss:docs:build',
    include: ['timcss:docs:generate', '--filter @timcss/docs build'],
    exclude: [],
  },
  {
    name: 'timcss:benchmark',
    include: ['timcss-benchmark.mjs'],
    exclude: [],
  },
  {
    name: 'timcss:benchmark:strict',
    include: ['timcss-benchmark.mjs --strict'],
    exclude: [],
  },
  {
    name: 'timcss:competitor:scorecard',
    include: ['timcss-competitor-scorecard.mjs'],
    exclude: [],
  },
  {
    name: 'timcss:release:smoke',
    include: ['timcss-release-smoke.mjs'],
    exclude: [],
  },
  {
    name: 'timcss:release:validate',
    include: ['timcss-release-validate.mjs'],
    exclude: [],
  },
  {
    name: 'timcss:example:wechat:build',
    include: ['run-timcss-cli.mjs build', 'examples/wechat-miniapp/timcss.config.json'],
    exclude: [],
  },
  {
    name: 'timcss:example:wechat:inspect',
    include: ['run-timcss-cli.mjs inspect', 'examples/wechat-miniapp/timcss.config.json'],
    exclude: [],
  },
  {
    name: 'timcss:example:wechat:doctor',
    include: ['run-timcss-cli.mjs doctor', 'examples/wechat-miniapp/timcss.config.json'],
    exclude: [],
  },
  {
    name: 'timcss:example:react:build',
    include: ['run-timcss-cli.mjs build', 'examples/react-mobile/timcss.config.json'],
    exclude: [],
  },
  {
    name: 'timcss:example:react:inspect',
    include: ['run-timcss-cli.mjs inspect', 'examples/react-mobile/timcss.config.json'],
    exclude: [],
  },
  {
    name: 'timcss:example:react:doctor',
    include: ['run-timcss-cli.mjs doctor', 'examples/react-mobile/timcss.config.json'],
    exclude: [],
  },
]

async function validatePackages() {
  let issues = []
  for (let name of requiredPackages) {
    let dir = path.join(root, 'packages', name)
    let pkgFile = path.join(dir, 'package.json')
    let srcFile = path.join(dir, 'src', 'index.ts')
    let tsconfig = path.join(dir, 'tsconfig.json')
    let tsupConfig = path.join(dir, 'tsup.config.ts')
    if (!(await pathExists(pkgFile))) {
      issues.push(`Missing package manifest: packages/${name}/package.json`)
      continue
    }
    let pkg = await readJson(pkgFile)
    if (!(await pathExists(srcFile))) issues.push(`Missing source entry: packages/${name}/src/index.ts`)
    if (!(await pathExists(tsconfig))) issues.push(`Missing tsconfig: packages/${name}/tsconfig.json`)
    if (!(await pathExists(tsupConfig))) issues.push(`Missing tsup config: packages/${name}/tsup.config.ts`)
    if (!pkg.scripts?.build) issues.push(`Missing build script in ${pkg.name}`)
    if (!pkg.scripts?.test) issues.push(`Missing test script in ${pkg.name}`)
    if (!pkg.scripts?.lint) issues.push(`Missing lint script in ${pkg.name}`)
    if (name === 'timcss-cli' && !pkg.bin?.timcss) issues.push('Missing CLI bin entry: packages/timcss-cli/package.json#bin.timcss')
  }
  return issues
}

async function validateDocs() {
  let issues = []
  for (let file of requiredDocs) {
    if (!(await pathExists(path.join(root, file)))) issues.push(`Missing documentation file: ${file}`)
  }

  let catalogFile = path.join(root, 'docs', 'atomic-utilities-index.json')
  if (await pathExists(catalogFile)) {
    let catalog = await readJson(catalogFile)
    if (!catalog.schemaVersion) issues.push('Catalog is missing schemaVersion')
    if (!catalog.packageVersion) issues.push('Catalog is missing packageVersion')
    if (!Array.isArray(catalog.items) || catalog.items.length === 0) issues.push('Catalog contains no items')
    for (let item of catalog.items ?? []) {
      for (let key of ['id', 'className', 'kind', 'platforms', 'sourcePackage', 'status', 'since']) {
        if (!(key in item)) issues.push(`Catalog item missing ${key}: ${item.className ?? '(unknown)'}`)
      }
    }
  }

  return issues
}

async function validateExamples() {
  let issues = []
  for (let dir of requiredExamples) {
    let full = path.join(root, dir)
    if (!(await pathExists(full))) {
      issues.push(`Missing example directory: ${dir}`)
      continue
    }
    if (!(await pathExists(path.join(full, 'package.json'))))
      issues.push(`Missing example manifest: ${dir}/package.json`)
    if (!(await pathExists(path.join(full, 'timcss.config.json'))))
      issues.push(`Missing TimCSS config: ${dir}/timcss.config.json`)
    if (!(await pathExists(path.join(full, 'README.md')))) issues.push(`Missing example README: ${dir}/README.md`)
  }
  return issues
}

function validateScriptContract(scriptName, scriptValue, contract) {
  let issues = []
  for (let token of contract.include) {
    if (!scriptValue.includes(token)) {
      issues.push(`Root script ${scriptName} is missing expected token: ${token}`)
    }
  }
  for (let token of contract.exclude) {
    if (scriptValue.includes(token)) {
      issues.push(`Root script ${scriptName} contains deprecated token: ${token}`)
    }
  }
  return issues
}

async function validateRootScripts() {
  let issues = []
  let rootPkg = await readJson(path.join(root, 'package.json'))
  for (let script of requiredRootScripts) {
    if (!rootPkg.scripts?.[script]) issues.push(`Missing root script: ${script}`)
  }

  for (let contract of rootScriptContracts) {
    let value = rootPkg.scripts?.[contract.name]
    if (!value) continue
    issues.push(...validateScriptContract(contract.name, value, contract))
  }

  return issues
}

let issues = [
  ...(await validatePackages()),
  ...(await validateDocs()),
  ...(await validateExamples()),
  ...(await validateRootScripts()),
]

let report = {
  ok: issues.length === 0,
  checkedAt: new Date().toISOString(),
  packageCount: requiredPackages.length,
  docsCount: requiredDocs.length,
  exampleCount: requiredExamples.length,
  rootScriptCount: requiredRootScripts.length,
  issues,
}

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
} else {
  process.stdout.write(
    `TimCSS release validation\n  ok: ${report.ok}\n  packages: ${report.packageCount}\n  docs: ${report.docsCount}\n  examples: ${report.exampleCount}\n  root scripts: ${report.rootScriptCount}\n`,
  )
  if (issues.length > 0) {
    process.stdout.write('\nIssues\n')
    process.stdout.write(issues.map((item) => `- ${item}`).join('\n') + '\n')
  }
}

process.exitCode = report.ok ? 0 : 1
