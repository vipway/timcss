import { expect, test } from 'vitest'
import {
  expandTimcssIntentTerms,
  includesTimcssTerm,
  isTimcssIntentQuery,
  normalizeTimcssIntentQuery,
  splitTimcssSearchTerms,
} from '../src/index'

test('normalizes intent query prefixes', () => {
  expect(normalizeTimcssIntentQuery('intent:底部安全区 吸底')).toBe('底部安全区 吸底')
  expect(normalizeTimcssIntentQuery('场景：按钮高度')).toBe('按钮高度')
})

test('detects intent-style queries from Chinese mobile terms', () => {
  expect(isTimcssIntentQuery('吸底按钮')).toBe(true)
  expect(isTimcssIntentQuery('intent:卡片圆角')).toBe(true)
  expect(isTimcssIntentQuery('px-page')).toBe(false)
})

test('expands intent terms through shared synonyms', () => {
  let terms = expandTimcssIntentTerms('底部安全区 吸底')
  expect(terms).toContain('safe')
  expect(terms).toContain('tabbar')
  expect(terms).toContain('吸底')
})

test('shares token splitting and includes checks', () => {
  expect(splitTimcssSearchTerms('卡片，圆角 / 阴影')).toEqual(['卡片', '圆角', '阴影'])
  expect(includesTimcssTerm('pb-tabbar-safe', 'SAFE')).toBe(true)
})
