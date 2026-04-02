import path from 'node:path'
import { readJson } from './_shared/fs.mjs'
import { auditOfficialTailwindCatalog } from './_shared/timcss-docs-audit.mjs'

const root = process.cwd()
const catalogFile = path.join(root, 'docs', 'atomic-utilities-index.json')
const catalog = await readJson(catalogFile)
const report = await auditOfficialTailwindCatalog(root, catalog.items)

if (!report.ok) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        officialCount: report.officialCount,
        docsOfficialCount: report.docsOfficialCount,
        timcssCount: report.timcssCount,
        missingCount: report.missing.length,
        extraCount: report.extra.length,
        modifierMismatchCount: report.modifierMismatches.length,
        missingSample: report.missing.slice(0, 20),
        extraSample: report.extra.slice(0, 20),
        modifierMismatchSample: report.modifierMismatches.slice(0, 10),
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

console.log(
  `[timcss-docs-audit] ok official=${report.officialCount} docsOfficial=${report.docsOfficialCount} timcss=${report.timcssCount}`,
)
