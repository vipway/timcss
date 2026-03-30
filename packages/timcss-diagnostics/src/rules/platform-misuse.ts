import type { TimcssDiagnostic, TimcssPlatform } from '@timcss/core'

export function checkPlatformMisuse(className: string, platform: TimcssPlatform): TimcssDiagnostic[] {
  if (
    platform !== 'wechat-miniprogram' &&
    /(?:^|:)(pb-safe|pt-safe|pr-safe|pl-safe|px-safe|py-safe|pb-tabbar-safe|pt-nav-safe|hairline(?:-[trbl])?)$/.test(className)
  ) {
    return [{
      code: 'TIM005',
      level: 'info',
      className,
      message: '检测到微信小程序平台专属 utility。',
      suggestion: '仅在 wechat-miniprogram 平台开启这些原子类。',
    }]
  }
  return []
}
