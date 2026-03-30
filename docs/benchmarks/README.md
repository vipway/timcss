# TimCSS Benchmark 指南

本目录用于沉淀 TimCSS 的可量化基准数据，目标是对外可解释、对内可回归。

其中 `timcss-benchmark` 用于展示 TimCSS 自身基线，`timcss:competitor:scorecard` 用于生成同环境对照评分卡。两者需要配套阅读，避免把受限项误读成完整对照结论。

这些文件都是生成产物，不是实时真值。版本号、包元数据、构建链路或样本变更后，必须重新执行基准命令再阅读结果。

## 基准命令

```bash
pnpm run timcss:benchmark
pnpm run timcss:benchmark:strict
pnpm run timcss:competitor:scorecard
```

输出文件：

- `timcss-benchmark-latest.json`
- `timcss-benchmark-latest.md`
- `competitor-scorecard-latest.json`
- `competitor-scorecard-latest.md`

如果你刚修改了版本号或包信息，至少重跑：

```bash
pnpm run timcss:docs:generate
pnpm run timcss:benchmark:strict
pnpm run timcss:competitor:scorecard
```

## 方法学说明

- `timcss-benchmark` 只衡量 TimCSS 自身基线，不替代竞品结论。
- `timcss:competitor:scorecard` 当前会生成“共享编译路径下的 Tailwind core 风格基线”对照。
- 若当前机器缺少 Rust/cargo，官方 Tailwind 扫描器相关维度会被明确标记为 `N/A`。
- 若竞品不存在与 `timcss catalog --intent` 同口径的接口，检索指标会保留空值并写明原因。

## 当前指标

- `inspect.wechat`：微信示例 inspect 性能
- `build.wechat`：微信示例 build 性能
- `catalog.query`：普通关键字检索性能
- `catalog.intent`：语义意图检索性能
- `scanner.missRate`：扫描漏检率（目标为 0）
- `hit@3 / hit@5`：意图检索命中率
- `wechatCssBytes`：产物体积

## 适用场景

- 发布前性能回归检查
- 文档检索质量回归
- 与竞品的对照实验输入

## 公开基线

基准脚本会额外生成公开口径报告：

- `public-benchmark-baseline.md`
