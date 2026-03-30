import type { TimcssDiagnostic } from '@timcss/core'

function removePrefix(value: string, prefix?: string): string {
  if (!prefix) return value
  let withDash = `${prefix}-`
  return value.startsWith(withDash) ? value.slice(withDash.length) : value
}

function parseCandidate(className: string, prefix?: string) {
  let segments = className.split(':').filter(Boolean).map((segment) => removePrefix(segment, prefix))
  if (segments.length === 0) return { variants: [] as string[], utility: '' }
  return {
    variants: segments.slice(0, -1),
    utility: segments[segments.length - 1],
  }
}

export function checkSemanticVariantUtilityConflict(className: string, prefix?: string): TimcssDiagnostic[] {
  let { variants, utility } = parseCandidate(className, prefix)
  if (variants.length === 0 || !utility) return []

  let diagnostics: TimcssDiagnostic[] = []

  if (variants.includes('safe') && utility.endsWith('-safe')) {
    diagnostics.push({
      code: 'TIM010',
      level: 'info',
      className,
      message: `语义可能重复：\`safe:\` 与 \`${utility}\` 同时出现`,
      suggestion: `通常可直接使用 \`${utility}\`，减少重复语义链。`,
    })
  }

  if (variants.includes('tabbar-present') && utility === 'pb-tabbar-safe') {
    diagnostics.push({
      code: 'TIM010',
      level: 'info',
      className,
      message: '语义可能重复：`tabbar-present:` 与 `pb-tabbar-safe` 同时出现',
      suggestion: '通常可直接使用 `pb-tabbar-safe`，避免重复条件链。',
    })
  }

  if (variants.includes('notch') && (utility === 'pt-safe' || utility === 'pt-nav-safe')) {
    diagnostics.push({
      code: 'TIM010',
      level: 'info',
      className,
      message: `语义可能重复：\`notch:\` 与 \`${utility}\` 同时出现`,
      suggestion: `通常可直接使用 \`${utility}\`，只在需要额外条件时再加 \`notch:\`。`,
    })
  }

  return diagnostics
}
