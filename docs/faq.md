# TimCSS FAQ

## TimCSS 当前官方支持哪些平台？

- 已验证：移动端 H5、原生微信小程序
- 可接入但需项目验证：Taro、uni-app

对外表述时，请不要把“可接入”写成“官方端到端已验证”。

## 为什么文档站强调“先搜问题，再找类名”？

因为 TimCSS 主要解决的是移动端真实问题，例如：

- 底部安全区
- tabbar 避让
- 按钮高度
- 发丝线分隔
- 卡片圆角与阴影

先搜问题，比先猜类名更快，也更不容易漏掉组合原子。

## 微信小程序为什么不需要像 tailwindcss-weapp 那样额外转换？

TimCSS 当前专注原生微信小程序输出：

- 直接扫描 `wxml`
- 直接输出 `wxss`
- 内置安全区、发丝线、移动端控件和状态变体能力

目标是减少额外转换链路和接入复杂度。

## 什么时候用 `output.file`，什么时候用 `output.dir`？

- H5 移动端：优先使用 `output.file`
- 微信小程序：优先使用 `output.dir`

如果是小程序页面级输出，通常让 TimCSS 自动按页输出，并按需生成 shared 层即可。

## 搜索不到类名怎么办？

建议按顺序排查：

1. 先改搜场景词，例如“安全区”“按钮高度”“卡片”
2. 再执行 `inspect`
3. 再执行 `doctor`
4. 最后确认 `content` globs 是否覆盖真实模板文件

如果 class 完全通过运行时动态拼接，也可能导致静态扫描命中不足。

## 发布前至少要跑什么？

最少执行：

```bash
pnpm run timcss:release:validate
pnpm run timcss:release:smoke
```

如果你刚改过版本号、包名或包元数据，还应补跑：

```bash
pnpm run timcss:docs:generate
pnpm run timcss:benchmark:strict
```
