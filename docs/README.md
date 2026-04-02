# TimCSS 文档导航

按“先明确定位 -> 再选接入路径 -> 再查原子类 -> 最后做发布检查”的顺序阅读最快。

如果你刚修改了版本号、包名或包元数据，先重新生成 docs 索引和基准产物，再看文档站与 benchmark 文件。

## 产品定位与入口

- `../README.md`：仓库入口、常用命令、默认行为
- `start-here.md`：中文产品文档入口与口径约束
- `timcss-product-architecture.md`：产品边界、分层与包职责

## 接入路径

- `integration-h5.md`：移动端 H5 接入路径
- `integration-wechat-miniapp.md`：原生微信小程序接入路径
- `integration-taro-uniapp.md`：Taro / uni-app 当前边界与接入建议
- `examples-guide.md`：当前官方示例与验证方式
- `local-development.md`：本地开发、实时预览、发布前流程

## 我想查类名

- `search-cheatsheet.md`：按场景词快速找类名
- `faq.md`：常见问题与接入边界
- `atomic-utilities-index.md`：人类可读索引
- `atomic-utilities-index.json`：工具可读索引

## 我准备发版

- `release-preflight-checklist.md`：发布前逐项检查
- `release-announcement.md`：对外发布说明模板
- `cli-json-contracts.md`：CLI 机器可读协议
- `benchmarks/README.md`：性能与检索基准说明
- `benchmarks/competitor-scorecard-template.md`：竞品对照评分卡模板
- `benchmarks/competitor-scorecard-latest.md`：竞品对照评分卡
- `benchmarks/public-benchmark-baseline.md`：公开基线报告

索引由源码自动生成：

```bash
pnpm run timcss:docs:generate
pnpm run timcss:docs:audit
```
