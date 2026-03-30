import path from 'node:path'
import { defineConfig } from 'vitest/config'

let root = __dirname

let alias = {
  '@timcss/core': path.resolve(root, 'packages/timcss-core/src/index.ts'),
  '@timcss/tokens': path.resolve(root, 'packages/timcss-tokens/src/index.ts'),
  '@timcss/preset-mobile': path.resolve(root, 'packages/timcss-preset-mobile/src/index.ts'),
  '@timcss/preset-wechat': path.resolve(root, 'packages/timcss-preset-wechat/src/index.ts'),
  '@timcss/variants': path.resolve(root, 'packages/timcss-variants/src/index.ts'),
  '@timcss/scanner': path.resolve(root, 'packages/timcss-scanner/src/index.ts'),
  '@timcss/diagnostics': path.resolve(root, 'packages/timcss-diagnostics/src/index.ts'),
  '@timcss/engine': path.resolve(root, 'packages/timcss-engine/src/index.ts'),
}

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    include: ['packages/timcss-*/tests/**/*.spec.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
