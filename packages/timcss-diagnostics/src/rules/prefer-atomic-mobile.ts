import type { TimcssDiagnostic } from '@timcss/core'

export function checkPreferAtomicMobile(className: string): TimcssDiagnostic[] {
  if (/^(px-\[32rpx\]|py-\[48rpx\]|p-\[32rpx\])$/.test(className)) {
    return [{
      code: 'TIM009',
      level: 'info',
      className,
      message: '检测到可以映射为 TimCSS 移动端原子 utility 的写法。',
      suggestion: '例如改用 px-page、py-section、p-card。',
    }]
  }
  return []
}
