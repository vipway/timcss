# TimCSS 产品架构

TimCSS 是一个 **基于 Tailwind 编译内核**、面向 **移动端与微信小程序** 的原子样式引擎。

## 产品原则

1. **Atomic first**：核心永远是原子类与可组合变体。
2. **Mobile-native tokens first**：token 使用移动端视觉标尺，而不是 rem 转换心智。
3. **Platform presets are additive**：微信小程序能力作为平台增强层，而不是污染核心层。
4. **Diagnostics guide teams**：不仅生成 CSS，还帮助团队写出更适合移动端的 class。
5. **Wechat runtime is not the web**：微信小程序默认不继承浏览器 reset，避免把 Web preflight 当成平台常识。
6. **Compile for delivery, not for nostalgia**：微信小程序产物默认优先输出可直接交付的扁平 CSS，包含压缩、token 内联，以及对 `@layer`/嵌套规则的展平，而不是保留 Web 运行时形态。
7. **Split by entry when it saves bytes**：构建层默认保留单文件简单路径，但在开启 per-entry 模式后，会把公共候选与入口差量拆开，优先优化真实交付体积，而不是只追求源码层面的“纯原子”形式。

## 包结构

- `@timcss/core`：类型、配置、协议、合并逻辑
- `@timcss/tokens`：移动端 token 与 `@theme` 渲染
- `@timcss/preset-mobile`：移动端原子 utility
- `@timcss/preset-wechat`：微信小程序平台原子 utility
- `@timcss/variants`：移动端状态变体
- `@timcss/scanner`：content 扫描与 candidate 提取
- `@timcss/diagnostics`：诊断与建议系统
- `@timcss/engine`：装配、编译、构建
- `@timcss/cli`：命令行入口

内部 workspace 应用：

- `@timcss/docs`：文档站，不对外发布
- `@timcss/example-wechat-miniapp`：示例工程，不对外发布
- `@timcss/example-react-mobile`：示例工程，不对外发布

## 构建策略

TimCSS 现在有两条明确的输出路径：

- `single`：默认模式，适合 demo、快速接入、统一产物输出
- `per-entry`：按入口拆分，公共候选进入 shared 层，入口文件只保留自己的差量原子；微信小程序始终输出 `pages/**/.wxss`，只有存在跨页复用候选时才额外生成 `app.wxss`

这条拆分链路同时复用了已有的按需生成和按需 token 逻辑：

- 只为命中的原子生成 CSS
- 只输出命中的 theme token 变量
- 移动端 preflight 只进入 shared 层，避免在每个入口重复出现

## 与 Tailwind / weapp-tailwindcss 的区别

TimCSS 不是“把 Web Tailwind 搬到小程序”的兼容层，也不是简单的单位转换器。

TimCSS 更强调：

- 原子性优先
- token 按移动端重建
- 小程序平台原子能力
- 移动端状态变体
- 诊断与工程建议

## 能力分层

### 核心能力（稳定）

- mobile tokens
- mobile atomic utilities
- wechat atomic utilities
- state variants
- build / inspect / doctor / print-entry
- 官方示例与验证：react-mobile、wechat-miniapp

### 增强能力（迭代）

- scanner adapters
- diagnostics suggestions
- config 边界场景
- Taro / uni-app 接入建议与验证链路补齐

### 实验能力

- recipes
- 更复杂的动态 class 解析
