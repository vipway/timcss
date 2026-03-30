# TimCSS 原子样式索引

> 本文件由 `scripts/generate-timcss-doc-index.mjs` 自动生成，请不要手工编辑。

- 索引 schema 版本：`1.2.0`
- TimCSS 版本：`0.0.1`

本文档按“类名 → 意图 → 输出 → 使用建议 → 元数据”的方式组织，便于全文检索。

搜索建议：

- 直接搜 class 名，如 `pb-safe`
- 搜意图关键词，如“卡片内边距”“触控热区”“底部安全区”
- 搜 CSS 属性，如 `padding-inline`、`box-shadow`
- 搜稳定性，如 `stable`、`experimental`

---

## 布局与间距

### `gap-card`
- ID：`timcss.utility.gap-card`
- 意图：卡片内部子元素的常规间距。
- 输出：`gap: var(--layout-card);`
- 适合：卡片内部标题、说明、按钮组。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `gap-section`
- ID：`timcss.utility.gap-section`
- 意图：模块与模块之间的主间距。
- 输出：`gap: var(--layout-section);`
- 适合：垂直 stack 布局。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `h-nav`
- ID：`timcss.utility.h-nav`
- 意图：导航区域高度。
- 输出：`height: var(--layout-nav);`
- 适合：顶部导航、沉浸式头部容器。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `h-tabbar`
- ID：`timcss.utility.h-tabbar`
- 意图：底部 tabbar 区域高度。
- 输出：`height: var(--layout-tabbar);`
- 适合：底部导航、吸底操作容器。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `p-card`
- ID：`timcss.utility.p-card`
- 意图：卡片默认内边距。
- 输出：`padding: var(--layout-card);`
- 适合：白底卡片、信息卡、订单卡。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `px-page`
- ID：`timcss.utility.px-page`
- 意图：页面左右基础边距。
- 输出：`padding-inline: var(--layout-page);`
- 适合：页面主容器、列表页、表单页。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `py-section`
- ID：`timcss.utility.py-section`
- 意图：模块上下节奏间距。
- 输出：`padding-block: var(--layout-section);`
- 适合：区块型页面、内容段落分组。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

## 控件与触控

### `h-control`
- ID：`timcss.utility.h-control`
- 意图：默认控件高度。
- 输出：`height: var(--control-md);`
- 适合：默认按钮、输入框、选择器。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `h-control-lg`
- ID：`timcss.utility.h-control-lg`
- 意图：大控件高度。
- 输出：`height: var(--control-lg);`
- 适合：强调按钮、主操作区。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `h-control-sm`
- ID：`timcss.utility.h-control-sm`
- 意图：小控件高度。
- 输出：`height: var(--control-sm);`
- 适合：紧凑按钮、紧凑表单。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `h-control-xl`
- ID：`timcss.utility.h-control-xl`
- 意图：超大控件高度。
- 输出：`height: var(--control-xl);`
- 适合：吸底主按钮、大尺寸操作区。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `h-control-xs`
- ID：`timcss.utility.h-control-xs`
- 意图：极小控件高度。
- 输出：`height: var(--control-xs);`
- 适合：小标签、小尺寸输入元素。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `min-h-touch`
- ID：`timcss.utility.min-h-touch`
- 意图：确保满足移动端触控热区。
- 输出：`min-height: var(--layout-touch);`
- 适合：任何可点击行、按钮、列表项。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

## 形状

### `rounded-card`
- ID：`timcss.utility.rounded-card`
- 意图：卡片圆角。
- 输出：`border-radius: var(--radius-lg);`
- 适合：卡片、弹层、信息块。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `rounded-control`
- ID：`timcss.utility.rounded-control`
- 意图：控件圆角。
- 输出：`border-radius: var(--radius-md);`
- 适合：按钮、输入框、胶囊控件。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

## 语义颜色与阴影

### `bg-background`
- ID：`timcss.utility.bg-background`
- 意图：页面背景色。
- 输出：`background-color: var(--color-background);`
- 适合：页面根节点、列表页底色。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `bg-primary`
- ID：`timcss.utility.bg-primary`
- 意图：主品牌背景色。
- 输出：`background-color: var(--color-primary);`
- 适合：主按钮、主状态块。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `bg-surface`
- ID：`timcss.utility.bg-surface`
- 意图：表面层背景色。
- 输出：`background-color: var(--color-surface);`
- 适合：卡片、弹层、白底容器。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `border-default`
- ID：`timcss.utility.border-default`
- 意图：默认边框色。
- 输出：`border-color: var(--color-border);`
- 适合：输入框、卡片边框、分隔线容器。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `text-muted`
- ID：`timcss.utility.text-muted`
- 意图：次级文本颜色。
- 输出：`color: var(--color-muted);`
- 适合：辅助说明、时间、备注。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `text-on-primary`
- ID：`timcss.utility.text-on-primary`
- 意图：主色背景上的文本色。
- 输出：`color: var(--color-on-primary);`
- 适合：主按钮文本、主色块内文案。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `text-primary`
- ID：`timcss.utility.text-primary`
- 意图：主要文本颜色。
- 输出：`color: var(--color-text);`
- 适合：正文、标题、主信息。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

## 语义颜色与阴影

### `shadow-card`
- ID：`timcss.utility.shadow-card`
- 意图：轻量卡片阴影。
- 输出：`box-shadow: var(--shadow-card);`
- 适合：默认卡片、轻浮层。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

### `shadow-elevated`
- ID：`timcss.utility.shadow-elevated`
- 意图：强调浮层阴影。
- 输出：`box-shadow: var(--shadow-elevated);`
- 适合：弹层、浮动操作面板。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-mobile`
- since：`0.0.1`

## 微信小程序安全区与发丝线

### `pb-safe`
- ID：`timcss.utility.pb-safe`
- 意图：底部安全区内边距。
- 输出：`padding-bottom: env(safe-area-inset-bottom);`
- 适合：吸底按钮、底部输入区。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `pb-tabbar-safe`
- ID：`timcss.utility.pb-tabbar-safe`
- 意图：为底部 tabbar 和安全区同时预留空间。
- 输出：`padding-bottom: calc(var(--layout-tabbar) + env(safe-area-inset-bottom));`
- 适合：吸底操作区、底部内容滚动容器。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `pl-safe`
- ID：`timcss.utility.pl-safe`
- 意图：左侧安全区内边距。
- 输出：`padding-left: env(safe-area-inset-left);`
- 适合：横向布局容器。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `pr-safe`
- ID：`timcss.utility.pr-safe`
- 意图：右侧安全区内边距。
- 输出：`padding-right: env(safe-area-inset-right);`
- 适合：横向布局容器。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `pt-nav-safe`
- ID：`timcss.utility.pt-nav-safe`
- 意图：为顶部导航和安全区同时预留空间。
- 输出：`padding-top: calc(var(--layout-nav) + env(safe-area-inset-top));`
- 适合：沉浸式页面头部。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `pt-safe`
- ID：`timcss.utility.pt-safe`
- 意图：顶部安全区内边距。
- 输出：`padding-top: env(safe-area-inset-top);`
- 适合：沉浸式头部、刘海屏顶部避让。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `px-safe`
- ID：`timcss.utility.px-safe`
- 意图：左右安全区内边距。
- 输出：`padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);`
- 适合：全宽容器。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `py-safe`
- ID：`timcss.utility.py-safe`
- 意图：上下安全区内边距。
- 输出：`padding-block: env(safe-area-inset-top) env(safe-area-inset-bottom);`
- 适合：整屏安全区容器。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

## 微信小程序安全区与发丝线

### `hairline`
- ID：`timcss.utility.hairline`
- 意图：全边发丝线。
- 输出：`box-shadow: inset 0 0 0 1px var(--color-border);`
- 适合：卡片外框、浅边框块。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `hairline-b`
- ID：`timcss.utility.hairline-b`
- 意图：下边发丝线。
- 输出：`box-shadow: inset 0 -1px 0 0 var(--color-border);`
- 适合：列表项底部分隔。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `hairline-l`
- ID：`timcss.utility.hairline-l`
- 意图：左边发丝线。
- 输出：`box-shadow: inset 1px 0 0 0 var(--color-border);`
- 适合：左侧边界线。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `hairline-r`
- ID：`timcss.utility.hairline-r`
- 意图：右边发丝线。
- 输出：`box-shadow: inset -1px 0 0 0 var(--color-border);`
- 适合：右侧边界线。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

### `hairline-t`
- ID：`timcss.utility.hairline-t`
- 意图：上边发丝线。
- 输出：`box-shadow: inset 0 1px 0 0 var(--color-border);`
- 适合：顶部边界线。
- 平台：wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/preset-wechat`
- since：`0.0.1`

## 状态变体

### `disabled:`
- ID：`timcss.variant.disabled:`
- 意图：禁用状态。
- 选择器：`&[disabled], &:disabled, &[aria-disabled="true"]`
- 适合：表单控件、按钮。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/variants`
- since：`0.0.1`

### `keyboard-open:`
- ID：`timcss.variant.keyboard-open:`
- 意图：软键盘打开时生效。
- 选择器：`[data-keyboard-open="true"] &`
- 适合：输入区、底部表单布局。
- 平台：mobile / wechat-miniprogram
- 稳定性：`experimental`
- 来源包：`@timcss/variants`
- since：`0.0.1`

### `notch:`
- ID：`timcss.variant.notch:`
- 意图：刘海屏上下文时生效。
- 选择器：`[data-device-notch="true"] &`
- 适合：沉浸式头部与吸底区域。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/variants`
- since：`0.0.1`

### `pressed:`
- ID：`timcss.variant.pressed:`
- 意图：按压状态。
- 选择器：`&:active`
- 适合：按钮、列表项、可点击块。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/variants`
- since：`0.0.1`

### `safe:`
- ID：`timcss.variant.safe:`
- 意图：处于安全区上下文时生效。
- 选择器：`[data-safe-area="true"] &`
- 适合：组件级安全区布局。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/variants`
- since：`0.0.1`

### `tabbar-present:`
- ID：`timcss.variant.tabbar-present:`
- 意图：页面存在 tabbar 时生效。
- 选择器：`[data-tabbar="true"] &`
- 适合：底部区域避让。
- 平台：mobile / wechat-miniprogram
- 稳定性：`stable`
- 来源包：`@timcss/variants`
- since：`0.0.1`

