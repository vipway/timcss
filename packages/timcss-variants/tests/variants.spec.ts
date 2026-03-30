import { expect, test } from 'vitest'
import { createMobileVariantsCss } from '../src/index'

test('renders variants', () => {
  let css = createMobileVariantsCss({ prefix: 'tm' })
  expect(css).toContain('@custom-variant tm-pressed')
  expect(css).toContain('@custom-variant tm-disabled')
})
