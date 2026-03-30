import type { TimcssDiagnostic } from '@timcss/core'

function removePrefix(value: string, prefix?: string): string {
  if (!prefix) return value
  let withDash = `${prefix}-`
  return value.startsWith(withDash) ? value.slice(withDash.length) : value
}

export function checkRedundantVariantChain(className: string, prefix?: string): TimcssDiagnostic[] {
  let variants = className
    .split(':')
    .slice(0, -1)
    .filter(Boolean)
    .map((segment) => removePrefix(segment, prefix))

  if (variants.length < 2) return []

  let seen = new Set<string>()
  for (let variant of variants) {
    if (seen.has(variant)) {
      return [{
        code: 'TIM008',
        level: 'info',
        className,
        message: `检测到重复状态变体链：${variant}:`,
        suggestion: '删除重复变体，保持每个 candidate 的状态链清晰且唯一。',
      }]
    }
    seen.add(variant)
  }

  return []
}
