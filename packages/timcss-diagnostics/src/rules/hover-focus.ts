import type { TimcssDiagnostic } from '@timcss/core'

export function checkHoverFocus(className: string): TimcssDiagnostic[] {
  if (/^(hover|focus|focus-visible):/.test(className)) {
    return [{
      code: 'TIM004',
      level: 'info',
      className,
      message: '检测到偏 Web 的交互变体。',
      suggestion: '移动端更推荐使用 pressed: 或 disabled:。',
    }]
  }
  return []
}
