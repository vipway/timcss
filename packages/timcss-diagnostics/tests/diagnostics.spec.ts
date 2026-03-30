import { expect, test } from 'vitest'
import { runDiagnostics } from '../src/index'

test('reports arbitrary px usage', () => {
  let items = runDiagnostics(['p-[32px]'])
  expect(items.some((item) => item.code === 'TIM001')).toBe(true)
})

test('reports unknown TimCSS utility when catalog context is provided', () => {
  let items = runDiagnostics(['bg-surfacex'], 'mobile', {
    knownUtilities: ['bg-surface', 'px-page'],
    knownVariants: ['pressed', 'disabled'],
  })
  expect(items.some((item) => item.code === 'TIM006')).toBe(true)
  expect(items.find((item) => item.code === 'TIM006')?.suggestion).toContain('bg-surface')
})

test('reports unknown TimCSS variant with prefix support', () => {
  let items = runDiagnostics(['tm-pressedx:tm-bg-primary'], 'mobile', {
    prefix: 'tm',
    knownUtilities: ['bg-primary'],
    knownVariants: ['pressed', 'disabled'],
  })
  expect(items.some((item) => item.code === 'TIM007')).toBe(true)
  expect(items.find((item) => item.code === 'TIM007')?.suggestion).toContain('pressed:')
})

test('reports redundant variant chains', () => {
  let items = runDiagnostics(['pressed:pressed:opacity-80'])
  expect(items.some((item) => item.code === 'TIM008')).toBe(true)
})

test('reports semantic conflict suggestions for safe variants and utilities', () => {
  let items = runDiagnostics(['safe:pb-safe', 'tabbar-present:pb-tabbar-safe'])
  expect(items.some((item) => item.code === 'TIM010' && item.className === 'safe:pb-safe')).toBe(true)
  expect(items.some((item) => item.code === 'TIM010' && item.className === 'tabbar-present:pb-tabbar-safe')).toBe(true)
})
