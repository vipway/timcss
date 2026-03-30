import type { TimcssVariantName, TimcssVariantOptions } from '@timcss/core'

const DEFAULT_SELECTORS: Record<TimcssVariantName, string> = {
  pressed: '&:active',
  disabled: '&[disabled], &:disabled, &[aria-disabled="true"]',
  safe: '[data-safe-area="true"] &',
  notch: '[data-device-notch="true"] &',
  'tabbar-present': '[data-tabbar="true"] &',
  'keyboard-open': '[data-keyboard-open="true"] &',
}

export function createMobileVariantsCss(options: TimcssVariantOptions = {}): string {
  if (options.enabled === false) return ''
  let p = options.prefix ? `${options.prefix}-` : ''
  let selectors = { ...DEFAULT_SELECTORS, ...(options.selectors ?? {}) }
  let entries = Object.entries(selectors)
  if (options.include) entries = entries.filter(([name]) => options.include!.includes(name as TimcssVariantName))
  if (options.exclude?.length) entries = entries.filter(([name]) => !options.exclude!.includes(name as TimcssVariantName))
  return entries.map(([name, selector]) => `@custom-variant ${p}${name} (${selector});`).join('\n')
}
