import type { TimcssDiagnostic } from '@timcss/core'

export function checkArbitraryUnits(className: string): TimcssDiagnostic[] {
  let out: TimcssDiagnostic[] = []
  if (/\[[^\]]*px[^\]]*\]/.test(className)) {
    out.push({
      code: 'TIM001',
      level: 'warning',
      className,
      message: '检测到 arbitrary value 中使用 px。',
      suggestion: '优先改为移动端 token，例如 p-4、px-page、h-control。',
    })
  }
  if (/\[[^\]]*rem[^\]]*\]/.test(className)) {
    out.push({
      code: 'TIM002',
      level: 'warning',
      className,
      message: '检测到 arbitrary value 中使用 rem。',
      suggestion: '移动端优先使用 rpx token 或 TimCSS 原子类。',
    })
  }
  return out
}
