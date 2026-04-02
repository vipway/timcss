import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const tailwindCssEntry = `@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css" layer(utilities);`

function normalizeModifiers(list) {
  return Array.isArray(list) ? list.filter(Boolean).map(String) : []
}

async function loadOfficialTailwindUtilityEntries(root) {
  const enginePackageManifest = path.join(root, 'packages', 'timcss-engine', 'package.json')
  const engineRequire = createRequire(enginePackageManifest)
  const tailwindModule = engineRequire('tailwindcss')

  async function loadStylesheet(id, base) {
    const resolved = path.isAbsolute(id) || id.startsWith('.') ? path.resolve(base, id) : engineRequire.resolve(id)
    return {
      path: resolved,
      base: path.dirname(resolved),
      content: await fs.readFile(resolved, 'utf8'),
    }
  }

  const designSystem = await tailwindModule.__unstable__loadDesignSystem(tailwindCssEntry, {
    base: root,
    loadStylesheet,
  })

  return designSystem.getClassList().map(([className, meta]) => ({
    className,
    modifiers: normalizeModifiers(meta?.modifiers),
  }))
}

export async function auditOfficialTailwindCatalog(root, catalogItems) {
  const officialEntries = await loadOfficialTailwindUtilityEntries(root)
  const docsOfficialEntries = (catalogItems ?? []).filter((item) => item?.sourcePackage === 'tailwindcss')

  const officialMap = new Map(officialEntries.map((entry) => [entry.className, entry]))
  const docsMap = new Map(docsOfficialEntries.map((entry) => [entry.className, entry]))

  const missing = []
  const extra = []
  const modifierMismatches = []

  for (const entry of officialEntries) {
    const docsEntry = docsMap.get(entry.className)
    if (!docsEntry) {
      missing.push(entry.className)
      continue
    }

    const officialModifiers = entry.modifiers.join(',')
    const docsModifiers = normalizeModifiers(docsEntry.modifiers).join(',')
    if (officialModifiers !== docsModifiers) {
      modifierMismatches.push({
        className: entry.className,
        official: entry.modifiers,
        docs: normalizeModifiers(docsEntry.modifiers),
      })
    }
  }

  for (const entry of docsOfficialEntries) {
    if (!officialMap.has(entry.className)) extra.push(entry.className)
  }

  return {
    ok: missing.length === 0 && extra.length === 0 && modifierMismatches.length === 0,
    officialCount: officialEntries.length,
    docsOfficialCount: docsOfficialEntries.length,
    timcssCount: (catalogItems ?? []).length - docsOfficialEntries.length,
    missing,
    extra,
    modifierMismatches,
  }
}
