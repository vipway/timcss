# TimCSS 竞品对照评分卡（最新，含受限项说明）

## 1. 基础信息

- 对比日期：2026-03-27T14:33:11.298Z
- 测试环境：v22.16.0 / darwin-arm64
- TimCSS 版本：0.0.1
- 竞品对象：Tailwind CSS v4 Core-Style Baseline（shared compile path）
- 竞品版本：4.2.1
- 场景仓库：examples/wechat-miniapp/src/pages/index/index.wxml
- 对照方法：竞品 A 使用同一样本与同一 CLI 入口，在共享编译路径下关闭 TimCSS 预设与变体生成 Tailwind core 风格基线；无法同口径执行的指标会明确标记 N/A。

## 2. 维度与评分

| 维度 | TimCSS | 竞品 A | 说明 |
| --- | --- | --- | --- |
| 编译性能（build mean/p95） | 45.51ms / 46.48ms | 41.25ms / 41.83ms | 同环境、同内容样本、共享编译路径 |
| 产物体积（css bytes） | 884 | 17 | 同样本构建输出体积 |
| 扫描准确率（miss rate） | 0.00% | N/A | 竞品扫描器在本环境因缺少 cargo 无法构建 |
| 文档检索成功率（hit@3） | 100.00% | N/A | 竞品无同口径 intent/catalog 接口 |

## 3. 关键证据

- TimCSS 基准报告：`docs/benchmarks/timcss-benchmark-latest.json`
- 竞品对照报告：`docs/benchmarks/competitor-scorecard-latest.json`
- 对照脚本：`scripts/timcss-competitor-scorecard.mjs`

## 4. 结论

- 当前已完成可同口径执行指标的实测填充（编译性能、产物体积），并明确保留受限项说明。
- 当前竞品 A 是“共享编译路径下的 Tailwind core 风格基线”，不等同于官方 Tailwind CLI 的全链路跑分。
- 安装 Rust/cargo 并补齐官方扫描器后，可继续扩展扫描准确率等维度的正式对照。

