import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import {
  DEFAULT_ADAPTERS,
  discoverFiles,
  extractStaticContentRoot,
  globPatternToRegExp,
  normalizePathSlashes,
} from '../src/index'
import { baselineFixtures } from './fixtures/baseline-fixtures.mjs'

function assertExtractionCoverage(actual: string[], expected: string[]) {
  let missing = expected.filter((token) => !actual.includes(token))
  let missRate = expected.length === 0 ? 0 : missing.length / expected.length
  expect(missRate).toBe(0)
}

test('react adapter extracts className strings', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'react')!
  let out = adapter.extractCandidates('<div className="px-page pressed:opacity-80" />')
  expect(out).toContain('px-page')
  expect(out).toContain('pressed:opacity-80')
})

test('react adapter extracts clsx and ternary literals', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'react')!
  let out = adapter.extractCandidates(`
    <button className={clsx('px-page', isActive && 'bg-primary', ['rounded-control', disabled ? 'disabled:opacity-40' : 'pressed:opacity-80'])} />
  `)
  expect(out).toContain('px-page')
  expect(out).toContain('bg-primary')
  expect(out).toContain('rounded-control')
  expect(out).toContain('disabled:opacity-40')
  expect(out).toContain('pressed:opacity-80')
})

test('react adapter extracts classes from twMerge and cva helpers', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'react')!
  let out = adapter.extractCandidates(`
    <div className={twMerge('flex px-page', cva('group', { variants: { tone: { primary: 'bg-primary text-on-primary' } } }))} />
  `)
  expect(out).toContain('flex')
  expect(out).toContain('px-page')
  expect(out).toContain('group')
  expect(out).toContain('bg-primary')
  expect(out).toContain('text-on-primary')
})

test('react adapter handles nested object expressions inside className braces', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'react')!
  let out = adapter.extractCandidates(`
    <div className={cn({ 'bg-primary': active }, isActive ? 'px-page' : 'py-section')} />
  `)
  expect(out).toContain('bg-primary')
  expect(out).toContain('px-page')
  expect(out).toContain('py-section')
})

test('react adapter handles nested helper calls outside className props', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'react')!
  let out = adapter.extractCandidates(`
    const klass = twMerge(cn('px-page', enabled && 'bg-primary'), 'py-section')
    export function Demo() { return <div className={klass} /> }
  `)
  expect(out).toContain('px-page')
  expect(out).toContain('bg-primary')
  expect(out).toContain('py-section')
})

test('vue adapter extracts static and bound class literals', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'vue')!
  let out = adapter.extractCandidates(`
    <template>
      <view class="px-page py-section" :class="['rounded-card', active ? 'bg-surface' : 'bg-background', { 'pressed:opacity-80': pressable }]"></view>
    </template>
  `)
  expect(out).toContain('px-page')
  expect(out).toContain('py-section')
  expect(out).toContain('rounded-card')
  expect(out).toContain('bg-surface')
  expect(out).toContain('bg-background')
  expect(out).toContain('pressed:opacity-80')
})

test('vue adapter handles nested template expressions and object maps', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'vue')!
  let out = adapter.extractCandidates(`
    <template>
      <view
        class="px-page"
        :class="[
          state === 'primary' ? 'bg-primary text-on-primary' : 'bg-surface text-primary',
          { 'pressed:opacity-80': pressable, 'disabled:opacity-40': disabled },
          sizeMap[size] || 'py-section'
        ]"
      />
    </template>
  `)

  assertExtractionCoverage(out, [
    'px-page',
    'bg-primary',
    'text-on-primary',
    'bg-surface',
    'text-primary',
    'pressed:opacity-80',
    'disabled:opacity-40',
    'py-section',
  ])
})

test('shared token parser keeps common plain utility tokens', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'html')!
  let out = adapter.extractCandidates('<div class="flex block container group peer"></div>')
  expect(out).toContain('flex')
  expect(out).toContain('block')
  expect(out).toContain('container')
  expect(out).toContain('group')
  expect(out).toContain('peer')
})

test('wechat adapter extracts literals inside template expressions', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'wechat-wxml')!
  let out = adapter.extractCandidates(`
    <view class="tm-px-page {{ active ? 'tm-bg-primary tm-text-on-primary' : 'tm-bg-surface' }}"></view>
  `)
  expect(out).toContain('tm-px-page')
  expect(out).toContain('tm-bg-primary')
  expect(out).toContain('tm-text-on-primary')
  expect(out).toContain('tm-bg-surface')
})

test('wechat adapter handles nested object literals in mustache without key false positives', () => {
  let adapter = DEFAULT_ADAPTERS.find((item) => item.name === 'wechat-wxml')!
  let out = adapter.extractCandidates(`
    <view class="tm-px-page {{ ({ active: 'tm-bg-primary tm-text-on-primary', idle: 'tm-bg-surface' })[state] }} tm-rounded-card"></view>
  `)
  assertExtractionCoverage(out, ['tm-px-page', 'tm-bg-primary', 'tm-text-on-primary', 'tm-bg-surface', 'tm-rounded-card'])
  expect(out).not.toContain('active:')
  expect(out).not.toContain('idle:')
})

test('scanner miss rate baseline remains zero on curated dynamic fixtures', () => {
  for (let fixture of baselineFixtures) {
    let adapter = DEFAULT_ADAPTERS.find((item) => item.name === fixture.adapter)!
    let out = adapter.extractCandidates(fixture.code)
    assertExtractionCoverage(out, fixture.expected)
    for (let value of fixture.absent ?? []) {
      expect(out).not.toContain(value)
    }
  }
})

test('discoverFiles matches src/**/* globs for direct child files', async () => {
  let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'timcss-scanner-'))
  try {
    await fs.mkdir(path.join(cwd, 'src'), { recursive: true })
    await fs.writeFile(path.join(cwd, 'src', 'App.tsx'), 'export default function App() { return null }', 'utf8')
    let files = await discoverFiles(['src/**/*.{tsx,jsx,html}'], cwd)
    expect(files.map((item) => path.basename(item))).toContain('App.tsx')
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('shared glob/path helpers keep cross-package matching behavior', () => {
  expect(normalizePathSlashes('src\\pages\\index.wxml')).toBe('src/pages/index.wxml')
  expect(extractStaticContentRoot('src/**/*.{tsx,jsx,html}')).toBe('src')
  expect(extractStaticContentRoot('src\\pages\\**\\*.wxml')).toBe('src/pages')
  expect(extractStaticContentRoot('**/*.wxml')).toBe('.')

  let regex = globPatternToRegExp('src/**/*.{tsx,jsx,html}')
  expect(regex.test('src/App.tsx')).toBe(true)
  expect(regex.test('src/pages/index.jsx')).toBe(true)
  expect(regex.test('app/src/index.html')).toBe(false)
})
