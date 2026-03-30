# TimCSS

TimCSS 是一个基于 Tailwind 编译内核、面向移动端与微信小程序的原子化样式引擎。

## 发布定位（中文站优先）

- 当前正式定位：移动端 H5 + 原生微信小程序。
- 当前真实状态：`examples/react-mobile` 与 `examples/wechat-miniapp` 已纳入仓库示例与发布校验链路。
- 关于 Taro / uni-app：当前提供扫描与配置层面的接入建议，不宣称“官方端到端已验证”；在补齐官方示例与发布级回归前，请按“项目内验证”使用。

建议先读：`docs/start-here.md`

## 先跑起来

```bash
pnpm install
pnpm run timcss:prepare
pnpm run timcss:release:validate
```

第一次进仓库，先跑上面 3 条命令。

- 想实时看微信小程序样式：`pnpm run timcss:example:wechat:dev`
- 想查类名或场景词：`pnpm run timcss:catalog -- --query safe`
- 想看文档站：`pnpm run timcss:docs:dev`

如果你刚改过版本号、包名或包元数据，接着重跑：

```bash
pnpm run timcss:docs:generate
pnpm run timcss:benchmark:strict
pnpm run timcss:competitor:scorecard
```

## 常用路径

- `docs/README.md`：文档导航
- `docs/start-here.md`：中文产品文档入口
- `docs/integration-h5.md`：H5 接入路径
- `docs/integration-wechat-miniapp.md`：原生微信小程序接入路径
- `docs/integration-taro-uniapp.md`：Taro/uni-app 接入边界与建议
- `docs/local-development.md`：本地开发流程
- `docs/examples-guide.md`：示例工程导览
- `docs/release-preflight-checklist.md`：发布前检查
- `docs/search-cheatsheet.md`：检索速查

## 常用命令

```bash
pnpm run timcss:build
pnpm run timcss:inspect
pnpm run timcss:doctor
pnpm run timcss:catalog -- --query safe
pnpm run timcss:docs:dev
pnpm run timcss:release:smoke
```

`timcss:competitor:scorecard` 会生成一份含“受限项说明”的对照评分卡。若本机未安装 Rust/cargo，扫描器相关竞品指标会明确标记为 `N/A`。

## 进一步阅读

- 微信小程序接入与默认行为：`docs/integration-wechat-miniapp.md`
- H5 接入：`docs/integration-h5.md`
- Taro / uni-app 边界：`docs/integration-taro-uniapp.md`
- 示例与排错：`docs/examples-guide.md`
- 本地开发与拆分输出：`docs/local-development.md`
