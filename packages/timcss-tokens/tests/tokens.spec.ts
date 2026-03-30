import { expect, test } from 'vitest'
import { createMobileTokens, renderMobileThemeCss } from '../src/index'

test('creates spacious tokens', () => {
  expect(createMobileTokens('spacious').layout.page).toBe('40rpx')
})

test('renders theme css', () => {
  expect(renderMobileThemeCss()).toContain('--control-md: 80rpx;')
})

test('renders only requested theme variables', () => {
  let css = renderMobileThemeCss('comfortable', {}, { includeVariables: ['--layout-page', '--color-primary'] })
  expect(css).toContain('--layout-page: 32rpx;')
  expect(css).toContain('--color-primary: #2563eb;')
  expect(css).not.toContain('--layout-section:')
  expect(css).not.toContain('--shadow-card:')
})
