# TimCSS 检索速查表

先想清楚你要解决什么问题，再搜关键词。

## 页面与布局

- 页面留白：`px-page` `py-section`
- 卡片容器：`p-card` `rounded-card` `shadow-card`
- 区块间距：`gap-section` `gap-card`

## 控件与交互

- 按钮高度：`h-control` `min-h-touch`
- 控件圆角：`rounded-control`
- 按压反馈：`pressed:`
- 禁用状态：`disabled:`

## 安全区与小程序能力

- 底部安全区：`pb-safe`
- tabbar 避让：`pb-tabbar-safe`
- 顶部沉浸式头部：`pt-nav-safe`
- 发丝线：`hairline` `hairline-b`

## 直接搜什么词

- 想找类名：`pb-safe` `pressed:` `tm-px-page`
- 想找场景词：`安全区` `按钮高度` `卡片` `发丝线`
- 想按平台筛：`mobile` `wechat-miniprogram`

## CLI 检索

```bash
pnpm run timcss:catalog -- --query safe
pnpm run timcss:catalog -- --query hairline
pnpm run timcss:catalog -- --intent "底部安全区 吸底"
pnpm run timcss:catalog -- --platform wechat-miniprogram --kind utility
pnpm run timcss:catalog -- --status experimental
```

## Docs 站检索

- 先搜场景词，再看推荐组合
- 需要缩小范围时，再加平台和稳定性筛选
- 不确定类名时，直接输入 `intent:底部安全区`
