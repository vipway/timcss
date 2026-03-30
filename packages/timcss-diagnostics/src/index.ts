import type { TimcssDiagnostic, TimcssPlatform } from '@timcss/core'
import { checkArbitraryUnits } from './rules/arbitrary-unit'
import { formatDiagnosticsJson } from './formatter/json'
import { formatDiagnosticsPretty } from './formatter/pretty'
import { checkHoverFocus } from './rules/hover-focus'
import { checkPlatformMisuse } from './rules/platform-misuse'
import { checkPreferAtomicMobile } from './rules/prefer-atomic-mobile'
import { checkRedundantVariantChain } from './rules/redundant-variant'
import { checkSemanticVariantUtilityConflict } from './rules/semantic-conflict'
import { checkTouchTarget } from './rules/touch-target'
import { checkUnknownTimcssCandidate } from './rules/unknown-candidate'

function toSet(values?: Set<string> | string[]) {
  if (!values) return undefined
  return values instanceof Set ? values : new Set(values)
}

export function runDiagnostics(
  candidates: string[],
  platform: TimcssPlatform = 'mobile',
  options: {
    knownUtilities?: Set<string> | string[]
    knownVariants?: Set<string> | string[]
    prefix?: string
  } = {},
): TimcssDiagnostic[] {
  let knownUtilities = toSet(options.knownUtilities)
  let knownVariants = toSet(options.knownVariants)
  let out: TimcssDiagnostic[] = []
  for (let className of candidates) {
    out.push(...checkArbitraryUnits(className))
    out.push(...checkTouchTarget(className))
    out.push(...checkHoverFocus(className))
    out.push(...checkPlatformMisuse(className, platform))
    out.push(...checkPreferAtomicMobile(className))
    out.push(...checkUnknownTimcssCandidate(className, { knownUtilities, knownVariants, prefix: options.prefix }))
    out.push(...checkRedundantVariantChain(className, options.prefix))
    out.push(...checkSemanticVariantUtilityConflict(className, options.prefix))
  }
  return out
}

export function formatDiagnostics(items: TimcssDiagnostic[], format: 'pretty' | 'json' = 'pretty') {
  return format === 'json' ? formatDiagnosticsJson(items) : formatDiagnosticsPretty(items)
}
