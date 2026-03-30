import { expect, test } from 'vitest'
import { createMobilePresetCss } from '../src/index'

test('renders mobile atomic utilities', () => {
  let css = createMobilePresetCss({ prefix: 'tm' })
  expect(css).toContain('@utility tm-px-page')
  expect(css).toContain('@utility tm-h-control')
})
