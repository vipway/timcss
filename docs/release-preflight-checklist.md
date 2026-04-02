# TimCSS 发布前检查清单

本清单用于 TimCSS 对外发布前的最终核对。

## 一、仓库与版本

- [ ] 已确认当前分支可发布
- [ ] `package.json` 中版本号统一
- [ ] `@timcss/*` 包名、导出字段、入口路径正确
- [ ] `README.md` 已更新到当前能力边界
- [ ] 版本号或包元数据变更后，已重新生成 docs 索引与 benchmark/scorecard 产物
- [ ] examples 中命令与配置可执行
- [ ] 已确认 `@timcss/docs`、`@timcss/example-*` 仅为内部 workspace 应用，不属于对外发布包

## 二、构建与类型

在仓库根目录执行：

```bash
pnpm install
pnpm run timcss:prepare
pnpm run timcss:release:validate
pnpm run timcss:docs:audit
pnpm run timcss:benchmark:strict
pnpm run timcss:typecheck
pnpm run timcss:scanner:baseline
pnpm run timcss:release:smoke
```

检查项：

- [ ] 根级依赖可安装
- [ ] 所有 `@timcss/*` 包可构建
- [ ] TypeScript 无阻塞错误
- [ ] CLI 可产出 `dist`
- [ ] engine 可正常引用 Tailwind 编译内核
- [ ] scanner baseline 漏扫率为 0
- [ ] benchmark strict 模式通过（性能与检索命中达标）
- [ ] 外部 release smoke 项目可安装并完成 inspect/build
- [ ] docs 索引与官方 Tailwind utility 清单一致

## 三、测试

执行：

```bash
pnpm run timcss:test
```

检查项：

- [ ] token、preset、variant 单元测试通过
- [ ] scanner fixture 通过
- [ ] diagnostics 规则测试通过
- [ ] engine integration 通过
- [ ] cli integration 通过

## 四、CLI 核心命令

在本地至少人工执行一次：

```bash
pnpm run timcss:doctor
pnpm run timcss:inspect
pnpm run timcss:build
pnpm run timcss:print-entry
pnpm run timcss:catalog -- --query safe
```

检查项：

- [ ] `doctor` 能识别内容文件数量与候选数
- [ ] `inspect` 能输出 diagnostics
- [ ] `build` 能生成 CSS 文件
- [ ] `print-entry` 输出的入口结构正确
- [ ] `catalog` 能按 query 返回原子元数据

## 五、examples 验证

### wechat-miniapp

- [ ] `px-page` 生效
- [ ] `pb-safe` 生效
- [ ] `hairline-b` 生效
- [ ] `pressed:` 变体可见于产物

### react-mobile

- [ ] `className` 中原子类可扫描
- [ ] `h-control` 可编译
- [ ] `bg-primary` / `text-on-primary` 可编译
- [ ] `disabled:` 变体可编译

## 六、文档检查

- [ ] 快速开始存在
- [ ] 本地启动命令存在
- [ ] 发布说明存在
- [ ] 原子样式索引存在
- [ ] docs 站展示的 TimCSS 版本与当前包版本一致
- [ ] docs 索引已重新生成
- [ ] 每个 TimCSS 原子 utility 都能在文档中检索到
- [ ] 每个 utility 都有“意图 / 输出 / 使用建议”描述
- [ ] 对外文案未夸大 Taro / uni-app 当前验证范围

## 七、公开能力边界

发布前再次确认对外说明与实现一致，避免文档与实现脱节。

### 核心能力（默认承诺）

- mobile tokens
- mobile atomic utilities
- wechat atomic utilities
- core variants
- CLI build / inspect / doctor / print-entry

### 增强能力（持续迭代）

- scanner adapters
- diagnostics suggestions
- config edge cases

### 实验能力（谨慎启用）

- recipes
- 更多平台 preset
- 复杂 arbitrary values

## 八、发布包自查

- [ ] `dist` 中无多余内部源码路径
- [ ] `exports` 字段可被 Node ESM 正常解析
- [ ] README 中安装命令无误
- [ ] 未提交临时目录、缓存目录、测试产物

## 九、回滚预案

- [ ] 保留上一版发布 zip
- [ ] 保留发布说明与变更摘要
- [ ] 准备已知问题列表与 workaround

## 十、发布后 24 小时重点观察

- [ ] 安装失败反馈
- [ ] CLI 无法运行反馈
- [ ] 小程序 safe-area 类反馈
- [ ] scanner 漏扫反馈
- [ ] diagnostics 误报反馈
- [ ] 文档检索与查找效率反馈
