const util = (name: string, body: string) => `@utility ${name} {\n${body}\n}`

export const MOBILE_PRESET_RULES = [
  { className: 'px-page', body: 'padding-inline: var(--layout-page);' },
  { className: 'py-section', body: 'padding-block: var(--layout-section);' },
  { className: 'p-card', body: 'padding: var(--layout-card);' },
  { className: 'gap-section', body: 'gap: var(--layout-section);' },
  { className: 'gap-card', body: 'gap: var(--layout-card);' },
  { className: 'h-nav', body: 'height: var(--layout-nav);' },
  { className: 'h-tabbar', body: 'height: var(--layout-tabbar);' },
  { className: 'h-control-xs', body: 'height: var(--control-xs);' },
  { className: 'h-control-sm', body: 'height: var(--control-sm);' },
  { className: 'h-control', body: 'height: var(--control-md);' },
  { className: 'h-control-lg', body: 'height: var(--control-lg);' },
  { className: 'h-control-xl', body: 'height: var(--control-xl);' },
  { className: 'min-h-touch', body: 'min-height: var(--layout-touch);' },
  { className: 'rounded-card', body: 'border-radius: var(--radius-lg);' },
  { className: 'rounded-control', body: 'border-radius: var(--radius-md);' },
  { className: 'bg-primary', body: 'background-color: var(--color-primary);' },
  { className: 'bg-surface', body: 'background-color: var(--color-surface);' },
  { className: 'bg-background', body: 'background-color: var(--color-background);' },
  { className: 'text-primary', body: 'color: var(--color-text);' },
  { className: 'text-muted', body: 'color: var(--color-muted);' },
  { className: 'text-on-primary', body: 'color: var(--color-on-primary);' },
  { className: 'border-default', body: 'border-color: var(--color-border);' },
  { className: 'shadow-card', body: 'box-shadow: var(--shadow-card);' },
  { className: 'shadow-elevated', body: 'box-shadow: var(--shadow-elevated);' },
] as const

export type MobilePresetOptions = {
  prefix?: string
  includeLayouts?: boolean
  includeControls?: boolean
  includeSemanticColors?: boolean
  includeClasses?: string[]
}

export function createMobilePresetCss(options: MobilePresetOptions = {}): string {
  let p = options.prefix ? `${options.prefix}-` : ''
  let includeLayouts = options.includeLayouts ?? true
  let includeControls = options.includeControls ?? true
  let includeSemanticColors = options.includeSemanticColors ?? true
  let includeClasses = options.includeClasses ? new Set(options.includeClasses) : null

  let rules = MOBILE_PRESET_RULES.filter((rule) => {
    if (rule.className.startsWith('h-control') || rule.className === 'min-h-touch' || rule.className.startsWith('rounded-')) {
      return includeControls
    }
    if (
      rule.className === 'bg-primary' ||
      rule.className === 'bg-surface' ||
      rule.className === 'bg-background' ||
      rule.className.startsWith('text-') ||
      rule.className === 'border-default' ||
      rule.className.startsWith('shadow-')
    ) {
      return includeSemanticColors
    }
    return includeLayouts
  }).map((rule) => ({
    className: rule.className,
    css: util(`${p}${rule.className}`, `  ${rule.body}`),
  }))

  return rules
    .filter((rule) => !includeClasses || includeClasses.has(rule.className))
    .map((rule) => rule.css)
    .join('\n\n')
}
