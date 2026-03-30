# TimCSS 本地开发流程

这份文档按任务流组织：第一次跑通、日常开发、实时预览、拆分输出、发布前检查。

## 环境要求

- Node.js 20+
- pnpm 9+
- Git

## 初始化

```bash
pnpm install
pnpm run timcss:prepare
pnpm run timcss:docs:generate
```

## 第一次跑通

先跑最短闭环：

```bash
pnpm run timcss:release:validate
pnpm run timcss:example:wechat:inspect
pnpm run timcss:docs:build
```

预期结果：

- 发布校验通过
- 微信示例 `inspect` 返回 `0 diagnostics`
- docs 站可以成功构建

## 日常开发

```bash
pnpm run timcss:doctor
pnpm run timcss:inspect
pnpm run timcss:build
pnpm run timcss:dev -- --wechat --config examples/wechat-miniapp/timcss.config.json
pnpm run timcss:print-entry
pnpm run timcss:catalog -- --query safe
pnpm run timcss:catalog -- --intent "底部安全区 吸底"
pnpm run timcss:docs:dev
pnpm run timcss:benchmark
```

## 内联快速验证

```bash
pnpm run timcss:build -- --platform wechat-miniprogram --content "<view class='px-page pb-safe hairline-b pressed:opacity-80'></view>"
```

适用场景：

- 快速确认类名是否能被扫描和编译
- 不想先准备示例目录，只想验证一段模板

默认行为：

- 小程序写文件构建默认压缩输出并内联 TimCSS token
- 会展平 `@layer` 与变体嵌套，输出更接近真实 WXSS
- 如需保留未压缩格式，可设置 `"output": { "minify": false }`
- 如需保留 CSS 变量，可设置 `"inlineThemeTokens": false`

## 微信小程序实时预览

先用这条命令：

```bash
pnpm run timcss:dev -- --wechat --config examples/wechat-miniapp/timcss.config.json
```

也可以在示例目录中使用：

```bash
pnpm run dev:timcss
```

默认行为：

- 监听 `content` 命中的源码文件和 `timcss.config.*`
- 单文件变更时只增量更新该文件的候选集，不重做整轮全量扫描
- 写产物时会跳过内容未变化的文件，减少微信开发者工具不必要的全局刷新
- `--watch-backend auto` 会优先 native，失败时自动回退到 polling
- 如需跨平台一致性更强的行为，可显式使用 `--watch-backend polling --poll-interval 200`

适用场景：

- 正在配合微信开发者工具调样式
- 希望改一页只刷新一页，不想每次全量重建

## 按入口拆分构建

想把 CSS 拆到页面入口，并把公共原子抽到单独文件时，再打开这个模式：

```json
{
  "output": {
    "mode": "per-entry",
    "dir": "dist",
    "sharedFile": "app.wxss",
    "sharedCandidateMinUsage": 2
  }
}
```

默认行为：

- 微信小程序在存在跨页复用候选时，shared 文件默认为 `app.wxss`
- 其他平台默认 shared 文件为 `shared.css`
- 每个入口文件只保留自己的差量原子
- 输出路径会按 `content` 的静态根目录对齐，例如 `src/pages/home.wxml -> dist/pages/home.wxss`
- `output.file` 只用于单文件模式；拆分模式下请改用 `output.dir` 和 `output.sharedFile`

如果需要显式控制“某个入口只扫描哪些源码”，再补 `output.entries`：

```json
{
  "output": {
    "mode": "per-entry",
    "dir": "dist",
    "entries": [
      {
        "name": "home",
        "include": ["src/pages/home/**/*.wxml"],
        "outputFile": "bundle/home.wxss"
      },
      {
        "name": "profile",
        "include": ["src/pages/profile/**/*.wxml"],
        "outputFile": "bundle/profile.wxss"
      }
    ]
  }
}
```

补充说明：

- `output.entries[*].include` 是入口自己的源码范围
- `output.entries[*].outputFile` 是入口产物路径；相对路径会基于 `output.dir` 解析
- 重复候选仍会自动提到 shared 层，不需要手写公共文件
- `doctor` 会提示未分配文件、重复命中的文件和空入口配置

## 一次性全量验证

```bash
pnpm run timcss:release:validate
pnpm run timcss:benchmark
pnpm run timcss:competitor:scorecard
pnpm run timcss:typecheck
pnpm run timcss:test
pnpm run timcss:scanner:baseline
pnpm run timcss:release:smoke
```

`pnpm run timcss:competitor:scorecard` 默认输出“含受限项说明”的评分卡。若当前环境缺少 Rust/cargo，扫描器相关竞品指标会标记为 `N/A`，这属于方法学限制，不应解读为 TimCSS 数据缺失。

## CLI JSON 输出

主命令支持 `--json`，用于 CI 或内部平台集成。协议见 `cli-json-contracts.md`。

```bash
timcss build --config timcss.config.json --json
timcss inspect --config timcss.config.json --json
timcss doctor --config timcss.config.json --json
timcss catalog --query safe --json
```

## 检索入口

- 文本索引：`atomic-utilities-index.md`
- 机器索引：`atomic-utilities-index.json`
- 快速查找：`search-cheatsheet.md`
