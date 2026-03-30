import type { TimcssScannerAdapter } from '../index'
import { extractClassTokensFromExpression, pushClassTokens, readBalancedSegment } from './shared'

const CLASS_RE = /\bclass\s*=\s*(["'])([\s\S]*?)\1/g

function stripMustacheExpressions(input: string) {
  let out = ''
  let i = 0
  while (i < input.length) {
    if (input[i] === '{' && input[i + 1] === '{') {
      let segment = readBalancedSegment(input, i, '{', '}')
      if (segment) {
        out += ' '
        i = segment.end
        continue
      }
    }
    out += input[i]
    i++
  }
  return out
}

export const wechatWxmlAdapter: TimcssScannerAdapter = {
  name: 'wechat-wxml',
  extensions: ['.wxml', '.axml', '.swan'],
  extractCandidates(code) {
    let out: string[] = []

    for (let match of code.matchAll(CLASS_RE)) {
      let content = stripMustacheExpressions(match[2])
      pushClassTokens(out, content)
      out.push(...extractClassTokensFromExpression(match[2]))
    }

    return out
  },
}
