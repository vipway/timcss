import type { TimcssDiagnostic } from '@timcss/core'

export function checkTouchTarget(className: string): TimcssDiagnostic[] {
  if (/^h-([1-9]|10)$/.test(className)) {
    return [{
      code: 'TIM003',
      level: 'warning',
      className,
      message: '当前高度可能低于舒适触控热区。',
      suggestion: '优先考虑 h-control、h-control-sm 或 min-h-touch。',
    }]
  }
  return []
}
