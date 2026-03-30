import type { TimcssScannerAdapter } from '../index'
import { extractClassTokensFromExpression, pushClassTokens } from './shared'

const STATIC_CLASS_RE = /(?:^|[\s<])class\s*=\s*(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g
const BOUND_CLASS_RE = /(?:\:class|v-bind:class)\s*=\s*(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g

export const vueAdapter: TimcssScannerAdapter = {
  name: 'vue',
  extensions: ['.vue'],
  extractCandidates(code) {
    let out: string[] = []

    for (let match of code.matchAll(STATIC_CLASS_RE)) {
      pushClassTokens(out, match[2])
    }

    for (let match of code.matchAll(BOUND_CLASS_RE)) {
      out.push(...extractClassTokensFromExpression(match[2]))
    }

    return out
  },
}
