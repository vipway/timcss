import type { TimcssDiagnostic } from '@timcss/core'

const TIMCSS_UTILITY_HINTS = [
  'safe',
  'hairline',
  'control',
  'page',
  'section',
  'card',
  'tabbar',
  'nav',
  'surface',
  'background',
  'on-primary',
  'shadow-elevated',
  'shadow-card',
  'border-default',
]

const TIMCSS_VARIANT_HINTS = ['pressed', 'disabled', 'safe', 'notch', 'tabbar', 'keyboard']

function removePrefix(value: string, prefix?: string): string {
  if (!prefix) return value
  let withDash = `${prefix}-`
  return value.startsWith(withDash) ? value.slice(withDash.length) : value
}

function splitCandidate(className: string, prefix?: string) {
  let segments = className.split(':').filter(Boolean).map((segment) => removePrefix(segment, prefix))
  if (segments.length === 0) return { variants: [], utility: '' }
  return {
    variants: segments.slice(0, -1),
    utility: segments[segments.length - 1],
  }
}

function looksLikeTimcssUtility(utility: string): boolean {
  let normalized = utility.toLowerCase()
  return TIMCSS_UTILITY_HINTS.some((hint) => normalized.includes(hint))
}

function looksLikeTimcssVariant(variant: string): boolean {
  let normalized = variant.toLowerCase()
  return TIMCSS_VARIANT_HINTS.some((hint) => normalized.includes(hint))
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0
  if (left.length === 0) return right.length
  if (right.length === 0) return left.length

  let prev = new Array(right.length + 1).fill(0).map((_, index) => index)
  let curr = new Array(right.length + 1).fill(0)

  for (let i = 1; i <= left.length; i++) {
    curr[0] = i
    for (let j = 1; j <= right.length; j++) {
      let cost = left[i - 1] === right[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[right.length]
}

function suggestClosest(value: string, known: Set<string>, limit = 3): string[] {
  if (known.size === 0) return []
  let normalized = value.toLowerCase()
  let maxDistance = Math.max(2, Math.floor(normalized.length * 0.4))
  let candidates = [...known]
    .map((item) => ({ item, distance: levenshteinDistance(normalized, item.toLowerCase()) }))
    .filter((entry) => entry.distance <= maxDistance)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance
      return a.item.localeCompare(b.item)
    })
    .slice(0, limit)
    .map((entry) => entry.item)
  return candidates
}

export function checkUnknownTimcssCandidate(
  className: string,
  options: {
    knownUtilities?: Set<string>
    knownVariants?: Set<string>
    prefix?: string
  } = {},
): TimcssDiagnostic[] {
  let knownUtilities = options.knownUtilities
  let knownVariants = options.knownVariants
  if ((!knownUtilities || knownUtilities.size === 0) && (!knownVariants || knownVariants.size === 0)) return []

  let { variants, utility } = splitCandidate(className, options.prefix)
  let diagnostics: TimcssDiagnostic[] = []

  if (knownVariants && knownVariants.size > 0) {
    for (let variant of variants) {
      if (knownVariants.has(variant)) continue
      if (!looksLikeTimcssVariant(variant)) continue
      let variantSuggestions = suggestClosest(variant, knownVariants)
      diagnostics.push({
        code: 'TIM007',
        level: 'warning',
        className,
        message: `检测到未知 TimCSS 变体：${variant}:`,
        suggestion:
          variantSuggestions.length > 0
            ? `可能是拼写错误，可尝试：${variantSuggestions.map((item) => `${item}:`).join(' / ')}`
            : '检查是否拼写错误，或确认该变体已在 variants 与 catalog 中注册。',
      })
    }
  }

  if (knownUtilities && knownUtilities.size > 0) {
    if (!knownUtilities.has(utility) && looksLikeTimcssUtility(utility)) {
      let utilitySuggestions = suggestClosest(utility, knownUtilities)
      diagnostics.push({
        code: 'TIM006',
        level: 'warning',
        className,
        message: `检测到未知 TimCSS 原子类：${utility}`,
        suggestion:
          utilitySuggestions.length > 0
            ? `可能是拼写错误，可尝试：${utilitySuggestions.join(' / ')}`
            : '检查是否拼写错误，或先在 preset / metadata 中注册后再使用。',
      })
    }
  }

  return diagnostics
}
