import type { TimcssScannerAdapter } from '../index'
import { pushClassTokens } from './shared'

const CLASS_ATTR_RE = /\bclass\s*=\s*(["'`])([^"'`]+)\1/g

export const htmlAdapter: TimcssScannerAdapter = {
  name: 'html',
  extensions: ['.html', '.htm'],
  extractCandidates(code) {
    let out: string[] = []
    for (let match of code.matchAll(CLASS_ATTR_RE)) {
      pushClassTokens(out, match[2])
    }
    return out
  },
}
