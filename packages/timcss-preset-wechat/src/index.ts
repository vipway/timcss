const util = (name: string, body: string) => `@utility ${name} {\n${body}\n}`

export const WECHAT_PRESET_RULES = [
  { className: 'pt-safe', body: 'padding-top: env(safe-area-inset-top);' },
  { className: 'pr-safe', body: 'padding-right: env(safe-area-inset-right);' },
  { className: 'pb-safe', body: 'padding-bottom: env(safe-area-inset-bottom);' },
  { className: 'pl-safe', body: 'padding-left: env(safe-area-inset-left);' },
  { className: 'px-safe', body: 'padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);' },
  { className: 'py-safe', body: 'padding-block: env(safe-area-inset-top) env(safe-area-inset-bottom);' },
  { className: 'pb-tabbar-safe', body: 'padding-bottom: calc(var(--layout-tabbar) + env(safe-area-inset-bottom));' },
  { className: 'pt-nav-safe', body: 'padding-top: calc(var(--layout-nav) + env(safe-area-inset-top));' },
  { className: 'hairline', body: 'box-shadow: inset 0 0 0 1px var(--color-border);' },
  { className: 'hairline-t', body: 'box-shadow: inset 0 1px 0 0 var(--color-border);' },
  { className: 'hairline-r', body: 'box-shadow: inset -1px 0 0 0 var(--color-border);' },
  { className: 'hairline-b', body: 'box-shadow: inset 0 -1px 0 0 var(--color-border);' },
  { className: 'hairline-l', body: 'box-shadow: inset 1px 0 0 0 var(--color-border);' },
] as const

export type WechatPresetOptions = { prefix?: string; includeClasses?: string[] }

export function createWechatPresetCss(options: WechatPresetOptions = {}): string {
  let p = options.prefix ? `${options.prefix}-` : ''
  let includeClasses = options.includeClasses ? new Set(options.includeClasses) : null
  let rules = WECHAT_PRESET_RULES.map((rule) => ({
    className: rule.className,
    css: util(`${p}${rule.className}`, `  ${rule.body}`),
  }))
  return rules
    .filter((rule) => !includeClasses || includeClasses.has(rule.className))
    .map((rule) => rule.css)
    .join('\n\n')
}
