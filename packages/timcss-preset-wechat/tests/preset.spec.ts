import { expect, test } from 'vitest'
import { createWechatPresetCss } from '../src/index'

test('renders wechat utilities', () => {
  let css = createWechatPresetCss({ prefix: 'tm' })
  expect(css).toContain('@utility tm-pb-safe')
  expect(css).toContain('@utility tm-hairline-b')
})
