import type { TimcssScannerAdapter } from '../index'
import { extractClassTokensFromExpression, pushClassTokens, readBalancedSegment } from './shared'

const CLASSNAME_STATIC_RE = /\bclassName\s*=\s*(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g
const CLASSNAME_ATTR_RE = /\bclassName\s*=/g
const CLASSNAMES_HELPER_RE = /\b(?:clsx|classnames|cn|twMerge|twJoin|cva)\b/g

function skipWhitespace(input: string, start: number) {
  let i = start
  while (i < input.length && /\s/.test(input[i])) i++
  return i
}

function findClassNameExpressions(input: string) {
  let out: string[] = []
  for (let match of input.matchAll(CLASSNAME_ATTR_RE)) {
    let index = skipWhitespace(input, match.index! + match[0].length)
    if (input[index] !== '{') continue
    let expression = readBalancedSegment(input, index, '{', '}')
    if (!expression) continue
    out.push(expression.content)
  }
  return out
}

function findHelperCallArguments(input: string) {
  let out: string[] = []
  for (let match of input.matchAll(CLASSNAMES_HELPER_RE)) {
    let nameEnd = (match.index ?? 0) + match[0].length
    let openIndex = skipWhitespace(input, nameEnd)
    if (input[openIndex] !== '(') continue
    let call = readBalancedSegment(input, openIndex, '(', ')')
    if (!call) continue
    out.push(call.content)
  }
  return out
}

export const reactAdapter: TimcssScannerAdapter = {
  name: 'react',
  extensions: ['.jsx', '.tsx'],
  extractCandidates(code) {
    let out: string[] = []

    for (let match of code.matchAll(CLASSNAME_STATIC_RE)) {
      pushClassTokens(out, match[2])
    }

    for (let expression of findClassNameExpressions(code)) {
      out.push(...extractClassTokensFromExpression(expression))
      for (let args of findHelperCallArguments(expression)) {
        out.push(...extractClassTokensFromExpression(args))
      }
    }

    for (let args of findHelperCallArguments(code)) {
      out.push(...extractClassTokensFromExpression(args))
    }

    return out
  },
}
