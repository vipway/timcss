# TimCSS CLI JSON 协议

TimCSS 提供统一 JSON 外层结构，方便 CI、IDE 和内部工具消费结果。

## 外层结构

```json
{
  "tool": "timcss",
  "command": "inspect",
  "schemaVersion": "1",
  "generatedAt": "2026-03-22T00:00:00.000Z",
  "payload": {}
}
```

顶层字段：

- `tool`：固定为 `timcss`
- `command`：`build`、`inspect`、`doctor`、`catalog`
- `schemaVersion`：当前协议版本
- `generatedAt`：ISO 时间戳
- `payload`：命令自己的结果体

## 支持的命令

```bash
timcss build --config timcss.config.json --json
timcss inspect --config timcss.config.json --json
timcss doctor --config timcss.config.json --json
timcss catalog --query safe --json
timcss catalog --intent "底部安全区 吸底" --json
```

## `payload` 说明

### `build`

用于描述构建产物、扫描结果、候选类和输出处理状态。

关键字段：

- `outputMode`：`single` 或 `per-entry`
- `outputDir`：拆分模式下的输出根目录；单文件模式为 `null`
- `artifacts`：实际构建产物列表

`artifacts` 项结构：

```json
{
  "kind": "shared",
  "sourceFile": null,
  "entryName": null,
  "sourcePatterns": null,
  "outputFile": "/abs/path/dist/app.wxss",
  "cssBytes": 128,
  "candidateCount": 3,
  "candidates": ["tm-px-page", "tm-py-section", "tm-bg-primary"]
}
```

说明：

- `kind = single` 表示单文件输出
- `kind = shared` 表示拆分模式下的公共层；微信小程序在检测到跨页复用候选时默认写为 `app.wxss`
- `kind = entry` 表示某个源码入口自己的差量 CSS / WXSS
- `entryName` / `sourcePatterns` 会在显式 `output.entries` 分组时返回，便于 IDE 或 CI 识别“这个产物对应哪一组源码”

### `inspect`

用于描述诊断结果、候选类命中、catalog 元数据命中和扫描摘要。

### `doctor`

用于描述环境检查、catalog 可用性、依赖包是否齐全、命令是否可运行，以及结构化 `checks` 详情。

### `catalog`

用于描述过滤后的 catalog 项和检索条件。`filters` 同时支持 `query` 与 `intent`，其中 `intent` 用于语义场景检索。

## 典型使用方

- CI 检查
- docs 站与索引工具
- 后续 IDE 集成
- 内部工具的元数据查询
- 发布校验看板
