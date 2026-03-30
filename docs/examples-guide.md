# TimCSS 示例工程导览

当前仓库有两个官方示例工程，覆盖 TimCSS 当前正式验证范围：移动端 H5 与原生微信小程序。

说明：当前官方示例只覆盖 `react-mobile` 与 `wechat-miniapp`。

## `examples/wechat-miniapp`

用途：验证微信小程序平台原子能力、按页输出和实时预览。

先跑：

```bash
pnpm run timcss:example:wechat:inspect
pnpm run timcss:example:wechat:build
pnpm run timcss:example:wechat:dev
```

预期结果：

- `inspect` 返回 `0 diagnostics`
- `build` 在 `dist/pages/**` 下产出 `.wxss`
- `dev` 启动后，修改 `wxml` 会自动更新对应 `.wxss`

出问题先看：

```bash
pnpm run timcss:example:wechat:doctor
```

代表类名：

- `tm-px-page`
- `tm-p-card`
- `tm-h-control`
- `tm-pb-tabbar-safe`
- `tm-hairline-b`
- `tm-pressed:opacity-80`

## `examples/react-mobile`

用途：验证移动端通用原子能力与状态变体。

先跑：

```bash
pnpm run timcss:example:react:inspect
pnpm run timcss:example:react:build
```

预期结果：

- `inspect` 能看到命中的移动端原子与状态变体
- `build` 成功输出移动端样式

出问题先看：

```bash
pnpm run timcss:example:react:doctor
```

代表类名：

- `px-page`
- `p-card`
- `h-control`
- `min-h-touch`
- `rounded-card`
- `bg-primary`
- `pressed:opacity-80`

## 推荐烟雾流程

```bash
pnpm run timcss:prepare
pnpm run timcss:release:validate
pnpm run timcss:example:wechat:inspect
pnpm run timcss:example:react:inspect
pnpm run timcss:example:wechat:doctor
pnpm run timcss:example:react:doctor
pnpm run timcss:docs:dev
```
