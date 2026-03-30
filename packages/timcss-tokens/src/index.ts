import type { TimcssDensity, TimcssThemeOverrides } from '@timcss/core'

export type MobileThemeVariableName = `--${string}`
export type RenderMobileThemeCssOptions = {
  includeVariables?: MobileThemeVariableName[]
}

export type MobileTokens = {
  spacing: string
  fontSize: Record<string, string>
  lineHeight: Record<string, string>
  radius: Record<string, string>
  controlHeight: Record<string, string>
  layout: Record<string, string>
  colors: Record<string, string>
  shadows: Record<string, string>
}

const BASE: MobileTokens = {
  spacing: '8rpx',
  fontSize: {
    xs: '20rpx',
    sm: '24rpx',
    base: '28rpx',
    lg: '32rpx',
    xl: '36rpx',
    '2xl': '40rpx',
    '3xl': '48rpx',
  },
  lineHeight: {
    xs: '28rpx',
    sm: '32rpx',
    base: '40rpx',
    lg: '44rpx',
    xl: '48rpx',
    '2xl': '56rpx',
    '3xl': '64rpx',
  },
  radius: {
    sm: '8rpx',
    DEFAULT: '12rpx',
    md: '16rpx',
    lg: '20rpx',
    xl: '24rpx',
    '2xl': '32rpx',
    full: '9999rpx',
  },
  controlHeight: {
    xs: '56rpx',
    sm: '64rpx',
    md: '80rpx',
    lg: '88rpx',
    xl: '96rpx',
  },
  layout: {
    page: '32rpx',
    section: '48rpx',
    card: '32rpx',
    touch: '88rpx',
    nav: '96rpx',
    tabbar: '100rpx',
  },
  colors: {
    primary: '#2563eb',
    surface: '#ffffff',
    background: '#f6f7fb',
    text: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    success: '#16a34a',
    danger: '#dc2626',
    warning: '#d97706',
    'on-primary': '#ffffff',
  },
  shadows: {
    card: '0 8rpx 24rpx rgba(15, 23, 42, 0.08)',
    elevated: '0 16rpx 48rpx rgba(15, 23, 42, 0.12)',
  },
}

const DENSITY: Record<TimcssDensity, Partial<MobileTokens>> = {
  compact: {
    layout: { page: '24rpx', section: '40rpx', card: '24rpx', touch: '80rpx', nav: '88rpx', tabbar: '96rpx' },
    controlHeight: { xs: '52rpx', sm: '60rpx', md: '72rpx', lg: '80rpx', xl: '88rpx' },
  },
  comfortable: {},
  spacious: {
    layout: { page: '40rpx', section: '56rpx', card: '40rpx', touch: '96rpx', nav: '104rpx', tabbar: '112rpx' },
    controlHeight: { xs: '60rpx', sm: '72rpx', md: '88rpx', lg: '96rpx', xl: '104rpx' },
  },
}

function mergeSection<T extends Record<string, string>>(base: T, a?: Partial<T>, b?: Partial<T>): T {
  return { ...base, ...(a ?? {}), ...(b ?? {}) }
}

export function createMobileTokens(
  density: TimcssDensity = 'comfortable',
  overrides: TimcssThemeOverrides = {},
): MobileTokens {
  let d = DENSITY[density] ?? {}
  return {
    spacing: overrides.spacing ?? d.spacing ?? BASE.spacing,
    fontSize: mergeSection(BASE.fontSize, d.fontSize, overrides.fontSize),
    lineHeight: mergeSection(BASE.lineHeight, d.lineHeight, overrides.lineHeight),
    radius: mergeSection(BASE.radius, d.radius, overrides.radius),
    controlHeight: mergeSection(BASE.controlHeight, d.controlHeight, overrides.controlHeight),
    layout: mergeSection(BASE.layout, d.layout, overrides.layout),
    colors: mergeSection(BASE.colors, d.colors, overrides.colors),
    shadows: mergeSection(BASE.shadows, d.shadows, overrides.shadows),
  }
}

export function renderMobileThemeCss(
  density: TimcssDensity = 'comfortable',
  overrides: TimcssThemeOverrides = {},
  options: RenderMobileThemeCssOptions = {},
): string {
  let t = createMobileTokens(density, overrides)
  let include = options.includeVariables ? new Set(options.includeVariables) : null
  let lines = ['@theme {']

  let push = (variable: MobileThemeVariableName, value: string) => {
    if (!include || include.has(variable)) lines.push(`  ${variable}: ${value};`)
  }

  push('--spacing', t.spacing)
  for (let [k, v] of Object.entries(t.fontSize)) push(`--text-${k}`, v)
  for (let [k, v] of Object.entries(t.lineHeight)) push(`--text-${k}--line-height`, v)
  for (let [k, v] of Object.entries(t.radius)) push(`--radius${k === 'DEFAULT' ? '' : `-${k}`}`, v)
  for (let [k, v] of Object.entries(t.controlHeight)) push(`--control-${k}`, v)
  for (let [k, v] of Object.entries(t.layout)) push(`--layout-${k}`, v)
  for (let [k, v] of Object.entries(t.colors)) push(`--color-${k}`, v)
  for (let [k, v] of Object.entries(t.shadows)) push(`--shadow-${k}`, v)

  if (lines.length === 1) return ''
  lines.push('}')
  return lines.join('\n')
}
