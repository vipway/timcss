# TimCSS Wechat Mini Program Example

This example shows TimCSS atomic utilities in a WeChat Mini Program style layout.

## What it demonstrates

- `tm-px-page` page gutters
- `tm-py-section` section spacing
- `tm-p-card` card padding
- `tm-h-control` control height
- `tm-rounded-card` and `tm-rounded-control`
- `tm-pb-safe` safe-area bottom padding
- `tm-hairline-b` thin border utility
- `tm-pressed:opacity-80` mobile pressed state

## Commands

From the repository root:

```bash
pnpm run timcss:example:wechat:build
pnpm run timcss:example:wechat:dev
pnpm run timcss:example:wechat:inspect
pnpm run timcss:example:wechat:doctor
```

`pnpm run timcss:example:wechat:dev` 会常驻监听 `src/**/*.wxml` 和 `timcss.config.json`，变更后只重写发生变化的 WXSS 文件，适合直接接到微信开发者工具做实时预览。

## Files

- `src/pages/index/index.wxml` main example page
- `timcss.config.json` TimCSS config for Wechat Mini Program
- `dist/pages/index/index.wxss` page-level on-demand stylesheet generated after `build`
- `dist/app.wxss` shared generated stylesheet when multiple pages reuse the same TimCSS candidates
