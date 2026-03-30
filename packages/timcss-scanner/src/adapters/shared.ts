import { splitClassTokens } from '@timcss/core'

const STRING_LITERAL_RE = /(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g
const KNOWN_PLAIN_UTILITY_TOKENS = new Set([
  'block',
  'inline',
  'inline-block',
  'hidden',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'contents',
  'relative',
  'absolute',
  'fixed',
  'sticky',
  'static',
  'container',
  'group',
  'peer',
  'sr-only',
  'not-sr-only',
])

function normalizeTemplateLiteral(content: string): string {
  return content.replace(/\$\{[^}]+\}/g, ' ')
}

function isClassToken(token: string): boolean {
  if (!/[A-Za-z]/.test(token)) return false
  if (!/^[A-Za-z0-9!_:/.[\]-]+$/.test(token)) return false
  if (/[-:[\]/.]/.test(token)) return true
  return KNOWN_PLAIN_UTILITY_TOKENS.has(token)
}

export function pushClassTokens(out: string[], input: string) {
  for (let token of splitClassTokens(input)) {
    if (isClassToken(token)) out.push(token)
  }
}

export function extractStringLiterals(input: string): string[] {
  let values: string[] = []
  for (let match of input.matchAll(STRING_LITERAL_RE)) {
    values.push(normalizeTemplateLiteral(match[2]))
  }
  return values
}

export function extractClassTokensFromExpression(expression: string): string[] {
  let out: string[] = []
  for (let value of extractStringLiterals(expression)) {
    pushClassTokens(out, value)
  }
  return out
}

function skipQuotedString(input: string, start: number, quote: string) {
  let i = start + 1
  while (i < input.length) {
    let ch = input[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === quote) return i + 1
    i++
  }
  return input.length
}

function skipTemplateString(input: string, start: number) {
  let i = start + 1
  while (i < input.length) {
    let ch = input[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === '`') return i + 1
    if (ch === '$' && input[i + 1] === '{') {
      let nested = readBalancedSegment(input, i + 1, '{', '}')
      if (!nested) return input.length
      i = nested.end
      continue
    }
    i++
  }
  return input.length
}

function skipLineComment(input: string, start: number) {
  let i = start + 2
  while (i < input.length && input[i] !== '\n') i++
  return i
}

function skipBlockComment(input: string, start: number) {
  let i = start + 2
  while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++
  return Math.min(i + 2, input.length)
}

export function readBalancedSegment(input: string, start: number, open: string, close: string) {
  if (input[start] !== open) return null

  let depth = 1
  let i = start + 1
  while (i < input.length) {
    let ch = input[i]
    if (ch === "'" || ch === '"') {
      i = skipQuotedString(input, i, ch)
      continue
    }
    if (ch === '`') {
      i = skipTemplateString(input, i)
      continue
    }
    if (ch === '/' && input[i + 1] === '/') {
      i = skipLineComment(input, i)
      continue
    }
    if (ch === '/' && input[i + 1] === '*') {
      i = skipBlockComment(input, i)
      continue
    }

    if (ch === open) depth += 1
    else if (ch === close) {
      depth -= 1
      if (depth === 0) {
        return {
          content: input.slice(start + 1, i),
          end: i + 1,
        }
      }
    }
    i++
  }

  return null
}
