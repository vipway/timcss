import './style.css'
import {
  expandTimcssIntentTerms,
  includesTimcssTerm,
  isTimcssIntentQuery,
  normalizeTimcssIntentQuery,
  splitTimcssSearchTerms,
} from '../../../packages/timcss-core/src/search'
import { createMobileTokens } from '../../../packages/timcss-tokens/src'
import docIndex from '../../../docs/atomic-utilities-index.json'

type StatusTag = 'stable' | 'experimental'
type PlatformTag = 'mobile' | 'wechat-miniprogram'
type KindTag = 'utility' | 'variant'
type RouteId = 'overview' | 'foundations' | 'guides' | 'browse' | 'recipes' | 'catalog' | 'faq'

type UtilityItem = {
  id: string
  className: string
  kind: KindTag
  category: string
  intent: string
  output: string
  whenToUse: string
  platforms: PlatformTag[]
  sourcePackage: string
  status: StatusTag
  since: string
  schemaVersion: string
}

type DocIndexPayload = {
  schemaVersion: string
  generatedAt: string
  packageVersion: string
  items: UtilityItem[]
}

type DocItem = UtilityItem & {
  tags: string[]
  description: string
  example: string
}

type SearchContext = {
  normalizedQuery: string
  terms: string[]
  intentMode: boolean
  intentTerms: string[]
  highlightQuery: string
}

type InputFocusSnapshot = {
  id: 'search-input' | 'palette-input'
  selectionStart: number | null
  selectionEnd: number | null
}

type Recipe = {
  id: string
  title: string
  description: string
  queryHints: string[]
  classes: string[]
  platforms: Array<PlatformTag | 'all'>
}

type Guide = {
  id: string
  title: string
  status: '已验证' | '需项目验证'
  platform: PlatformTag | 'all'
  summary: string
  steps: string[]
  config: string
  commands: string[]
}

type FaqItem = {
  question: string
  answer: string
}

type CommandItem = {
  id: string
  title: string
  subtitle: string
  keywords: string[]
  action(): void
}

type DocsHashState = {
  route: RouteId
  query: string
  platform: 'all' | PlatformTag
  category: string
  selected: string
}

type OverviewPath = {
  title: string
  summary: string
  route: RouteId
  actionLabel: string
}

type FoundationScale = {
  title: string
  value: string
  detail: string
  classes: string[]
}

const staleIndexThresholdMs = 7 * 24 * 60 * 60 * 1000
let ignoreNextHashChange = false

const categoryOrder = [
  'layout',
  'control',
  'shape',
  'color',
  'shadow',
  'wechat-safe-area',
  'wechat-hairline',
  'variant',
] as const

const categoryLabels: Record<string, string> = {
  all: '全部',
  layout: '布局',
  control: '控件',
  shape: '形状',
  color: '颜色',
  shadow: '阴影',
  'wechat-safe-area': '安全区',
  'wechat-hairline': '发丝线',
  variant: '状态',
}

const platformLabels: Record<string, string> = {
  all: '全部平台',
  mobile: 'H5 移动端',
  'wechat-miniprogram': '微信小程序',
}

const routeLabels: Record<RouteId, string> = {
  overview: '总览',
  foundations: '尺寸基础',
  guides: '开始使用',
  browse: '分类浏览',
  recipes: '常用组合',
  catalog: '原子检索',
  faq: 'FAQ',
}
const routeOrder: RouteId[] = ['overview', 'foundations', 'guides', 'browse', 'recipes', 'catalog', 'faq']

const quickSearches = ['底部安全区 吸底', '按钮高度 触控', '卡片圆角 阴影', '发丝线 分隔', 'pressed:']

const overviewPaths: OverviewPath[] = [
  {
    title: '先看尺寸体系',
    summary: '先理解页面留白、模块节奏、触控高度和安全区，再选原子，整体会更稳。',
    route: 'foundations',
    actionLabel: '查看尺寸规则',
  },
  {
    title: '第一次接入',
    summary: '先看平台边界、最小配置和第一条验证命令，再决定进入哪条集成路径。',
    route: 'guides',
    actionLabel: '查看接入方式',
  },
  {
    title: '直接查原子',
    summary: '按问题、意图和类名搜索，适合已经知道自己要解决什么布局或交互问题。',
    route: 'catalog',
    actionLabel: '开始检索',
  },
  {
    title: '先拿组合',
    summary: '如果你还不想从单个原子开始，可以先复制高频移动端组合，再按业务微调。',
    route: 'recipes',
    actionLabel: '查看常用组合',
  },
]

const comfortableTokens = createMobileTokens('comfortable')
const compactTokens = createMobileTokens('compact')
const spaciousTokens = createMobileTokens('spacious')

const foundationScales: FoundationScale[] = [
  {
    title: '页面留白',
    value: comfortableTokens.layout.page,
    detail: `默认页边距。compact ${compactTokens.layout.page}，spacious ${spaciousTokens.layout.page}。`,
    classes: ['px-page'],
  },
  {
    title: '模块节奏',
    value: comfortableTokens.layout.section,
    detail: `默认模块上下节奏。compact ${compactTokens.layout.section}，spacious ${spaciousTokens.layout.section}。`,
    classes: ['py-section', 'gap-section'],
  },
  {
    title: '卡片内边距',
    value: comfortableTokens.layout.card,
    detail: `默认卡片内距。compact ${compactTokens.layout.card}，spacious ${spaciousTokens.layout.card}。`,
    classes: ['p-card', 'gap-card'],
  },
  {
    title: '触控热区',
    value: comfortableTokens.layout.touch,
    detail: `点击区域最小高度。compact ${compactTokens.layout.touch}，spacious ${spaciousTokens.layout.touch}。`,
    classes: ['min-h-touch'],
  },
  {
    title: '默认控件高',
    value: comfortableTokens.controlHeight.md,
    detail: `默认按钮/输入高度。sm ${comfortableTokens.controlHeight.sm}，lg ${comfortableTokens.controlHeight.lg}。`,
    classes: ['h-control', 'h-control-sm', 'h-control-lg'],
  },
  {
    title: '导航与底栏',
    value: `${comfortableTokens.layout.nav} / ${comfortableTokens.layout.tabbar}`,
    detail: `导航高 ${comfortableTokens.layout.nav}，tabbar 高 ${comfortableTokens.layout.tabbar}。`,
    classes: ['h-nav', 'h-tabbar', 'pt-nav-safe', 'pb-tabbar-safe'],
  },
]

function convertRpxToPreviewPx(value: string, factor = 0.5) {
  return value.replace(/(-?\d*\.?\d+)rpx/g, (_, num) => `${Number(num) * factor}px`)
}

function toStyleAttribute(style: Record<string, string>) {
  return Object.entries(style)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
}

const previewThemeStyle = toStyleAttribute({
  '--preview-page': convertRpxToPreviewPx(comfortableTokens.layout.page),
  '--preview-section': convertRpxToPreviewPx(comfortableTokens.layout.section),
  '--preview-card-padding': convertRpxToPreviewPx(comfortableTokens.layout.card),
  '--preview-touch': convertRpxToPreviewPx(comfortableTokens.layout.touch),
  '--preview-nav': convertRpxToPreviewPx(comfortableTokens.layout.nav),
  '--preview-tabbar': convertRpxToPreviewPx(comfortableTokens.layout.tabbar),
  '--preview-control-xs': convertRpxToPreviewPx(comfortableTokens.controlHeight.xs),
  '--preview-control-sm': convertRpxToPreviewPx(comfortableTokens.controlHeight.sm),
  '--preview-control-md': convertRpxToPreviewPx(comfortableTokens.controlHeight.md),
  '--preview-control-lg': convertRpxToPreviewPx(comfortableTokens.controlHeight.lg),
  '--preview-control-xl': convertRpxToPreviewPx(comfortableTokens.controlHeight.xl),
  '--preview-radius-card': convertRpxToPreviewPx(comfortableTokens.radius.lg),
  '--preview-radius-control': convertRpxToPreviewPx(comfortableTokens.radius.md),
  '--preview-border': comfortableTokens.colors.border,
  '--preview-primary': comfortableTokens.colors.primary,
  '--preview-surface': comfortableTokens.colors.surface,
  '--preview-background': comfortableTokens.colors.background,
  '--preview-text': comfortableTokens.colors.text,
  '--preview-muted': comfortableTokens.colors.muted,
  '--preview-on-primary': comfortableTokens.colors['on-primary'],
  '--preview-shadow-card': convertRpxToPreviewPx(comfortableTokens.shadows.card),
  '--preview-shadow-elevated': convertRpxToPreviewPx(comfortableTokens.shadows.elevated),
})

const recipes: Recipe[] = [
  {
    id: 'bottom-action',
    title: '吸底主操作区',
    description: '底部按钮区避免被 tabbar 和安全区遮挡。',
    queryHints: ['底部安全区', '吸底', 'tabbar', '底部按钮'],
    classes: ['pb-tabbar-safe', 'h-control', 'rounded-control', 'bg-primary', 'text-on-primary'],
    platforms: ['wechat-miniprogram'],
  },
  {
    id: 'card-surface',
    title: '卡片信息区',
    description: '列表卡片、摘要面板、信息块的默认组合。',
    queryHints: ['卡片', '圆角', '阴影', '信息块'],
    classes: ['p-card', 'rounded-card', 'bg-surface', 'shadow-card', 'text-primary'],
    platforms: ['all'],
  },
  {
    id: 'touch-control',
    title: '高可点按控件',
    description: '保证按钮和点击行拥有一致的高度、圆角和反馈。',
    queryHints: ['按钮高度', '触控', '交互', '点击'],
    classes: ['h-control', 'min-h-touch', 'rounded-control', 'pressed:opacity-80'],
    platforms: ['all'],
  },
  {
    id: 'wechat-divider',
    title: '小程序分隔列表',
    description: '适合微信小程序列表分隔、浅边框和轻层级。',
    queryHints: ['发丝线', '分隔', '边框', '列表'],
    classes: ['hairline-b', 'px-page', 'py-section', 'text-muted'],
    platforms: ['wechat-miniprogram'],
  },
]

const guides: Guide[] = [
  {
    id: 'h5',
    title: '移动端 H5',
    status: '已验证',
    platform: 'mobile',
    summary: '适合 React / Vue 的移动端页面，输出单文件 CSS 最直接。',
    steps: ['安装并生成产物', '确认 content globs', '先 inspect 再 build'],
    config: `{
  "platform": "mobile",
  "content": ["src/**/*.{tsx,jsx,vue,html}"],
  "output": { "file": "dist/timcss.css" }
}`,
    commands: [
      'pnpm run timcss:inspect -- --config timcss.config.json',
      'pnpm run timcss:build -- --config timcss.config.json',
      'pnpm run timcss:doctor -- --config timcss.config.json',
    ],
  },
  {
    id: 'wechat',
    title: '原生微信小程序',
    status: '已验证',
    platform: 'wechat-miniprogram',
    summary: '适合原生小程序项目，默认按页输出 WXSS，不需要额外 class 转换链路。',
    steps: ['声明 wxml 扫描范围', '直接输出 dist', '验证 shared / per-entry 产物'],
    config: `{
  "platform": "wechat-miniprogram",
  "prefix": "tm",
  "content": ["src/**/*.wxml"],
  "output": { "dir": "dist" }
}`,
    commands: [
      'pnpm run timcss:example:wechat:inspect',
      'pnpm run timcss:example:wechat:build',
      'pnpm run timcss:example:wechat:doctor',
    ],
  },
  {
    id: 'taro-uniapp',
    title: 'Taro / uni-app',
    status: '需项目验证',
    platform: 'all',
    summary: '当前提供接入建议，不宣称官方端到端已验证。',
    steps: ['先确认编译后模板文件是否可扫', '先跑 inspect', '项目内补充验收'],
    config: `{
  "content": ["src/**/*.{wxml,axml,swan,vue,tsx,jsx}"]
}`,
    commands: ['pnpm run timcss:inspect -- --config timcss.config.json'],
  },
]

const faqs: FaqItem[] = [
  {
    question: 'TimCSS 现在官方支持哪些平台？',
    answer: '当前官方验证范围是移动端 H5 和原生微信小程序。Taro / uni-app 提供接入建议，但仍需要项目内验证。',
  },
  {
    question: '为什么强调“先搜问题，再找类名”？',
    answer: 'TimCSS 的原子类围绕移动端问题命名和组织。先搜“底部安全区”“按钮高度”“发丝线”比先猜类名更快，也更不容易漏掉组合类。',
  },
  {
    question: '微信小程序为什么不需要像 tailwindcss-weapp 那样额外转换？',
    answer: 'TimCSS 直接面向原生微信小程序输出 WXSS，并内置安全区、发丝线和状态变体能力，不依赖额外 class 转换链路。',
  },
  {
    question: '什么时候用 output.file，什么时候用 output.dir？',
    answer: 'H5 移动端优先用 output.file 生成单文件 CSS；微信小程序优先用 output.dir 按页输出。需要 shared 层时，让 TimCSS 自动拆分即可。',
  },
  {
    question: '移动端尺寸为什么优先从 px-page、py-section、h-control、min-h-touch 开始？',
    answer: '因为它们分别对应页面留白、模块节奏、控件高度和触控热区这四个基础层。先稳定这四层，页面会比到处手写 margin、padding、height 更整齐，也更容易统一成设计规范。',
  },
  {
    question: 'TimCSS 的 rpx 尺寸怎么理解，compact / comfortable / spacious 又该怎么选？',
    answer: 'TimCSS 的移动端 token 以 8rpx 为基准，comfortable 作为默认密度。信息密度高的业务页可选 compact，强调可读性或大按钮场景可选 spacious，但一页里最好保持同一套 density，不要混着用。',
  },
  {
    question: '搜索不到类名怎么办？',
    answer: '先换成场景词搜索，再执行 inspect 和 doctor。若仍无结果，先确认 content globs 覆盖了真实模板文件，再检查是否写了无法静态提取的动态 class。',
  },
  {
    question: '发布前至少要跑什么？',
    answer: '至少执行 timcss:release:validate、timcss:release:smoke，并在改过包元数据后重新生成 docs 索引。',
  },
]

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function highlight(value: string, query: string) {
  if (!query.trim()) return escapeHtml(value)
  let safe = escapeHtml(value)
  let escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let regex = new RegExp(`(${escaped})`, 'ig')
  return safe.replace(regex, '<mark>$1</mark>')
}

function deriveTags(item: UtilityItem) {
  let tags = new Set<string>()
  tags.add(categoryLabels[item.category] ?? item.category)
  tags.add(item.kind === 'variant' ? '状态' : '原子')
  if (item.platforms.includes('mobile')) tags.add('H5')
  if (item.platforms.includes('wechat-miniprogram')) tags.add('小程序')
  if (item.status === 'experimental') tags.add('实验')
  return [...tags]
}

function deriveDescription(item: UtilityItem) {
  if (item.kind === 'variant') {
    return `${item.className} 用于给原子类增加状态上下文，适合和 opacity、translate、safe-area、spacing 一起组合。`
  }
  return `${item.className} 用于${item.intent}，强调单一职责，适合与布局、颜色、形状、状态原子自由组合。`
}

function deriveExample(item: UtilityItem) {
  let examples: Record<string, string> = {
    'px-page': `<view class="px-page">页面主容器</view>`,
    'py-section': `<section class="py-section">模块内容</section>`,
    'p-card': `<view class="p-card rounded-card bg-surface shadow-card">卡片内容</view>`,
    'rounded-card': `<view class="rounded-card bg-surface p-card">信息卡片</view>`,
    'rounded-control': `<button class="rounded-control h-control px-4 bg-primary text-on-primary">按钮</button>`,
    'h-control': `<button class="h-control px-4 rounded-control bg-primary text-on-primary">主要操作</button>`,
    'min-h-touch': `<view class="min-h-touch flex items-center">可点击行</view>`,
    'bg-primary': `<button class="bg-primary text-on-primary h-control px-4 rounded-control">提交</button>`,
    'bg-surface': `<view class="bg-surface p-card rounded-card">白底容器</view>`,
    'text-primary': `<text class="text-primary">主文本</text>`,
    'text-muted': `<text class="text-muted">辅助说明</text>`,
    'pb-safe': `<view class="pb-safe px-page">底部安全区</view>`,
    'pb-tabbar-safe': `<view class="pb-tabbar-safe px-page">吸底区</view>`,
    'pt-nav-safe': `<view class="pt-nav-safe px-page">沉浸式头部</view>`,
    hairline: `<view class="hairline rounded-card p-card">浅边框卡片</view>`,
    'hairline-b': `<view class="hairline-b">列表分隔</view>`,
    'pressed:': `<button class="h-control px-page rounded-control bg-primary text-on-primary pressed:opacity-80">立即提交</button>`,
    'disabled:': `<button class="h-control px-page rounded-control bg-primary text-on-primary disabled:opacity-40">不可用</button>`,
  }

  return examples[item.className] ?? `<view class="${item.className}">示例</view>`
}

function toDocItem(item: UtilityItem): DocItem {
  return {
    ...item,
    tags: deriveTags(item),
    description: deriveDescription(item),
    example: deriveExample(item),
  }
}

function getRelatedClassNames(item: DocItem) {
  let related: string[] = []

  if (item.kind === 'variant') {
    related.push('h-control', 'min-h-touch')
    if (item.className === 'pressed:') related.push('rounded-control', 'bg-primary', 'text-on-primary')
    if (item.className === 'disabled:') related.push('h-control', 'text-muted')
    if (item.className === 'notch:' || item.className === 'safe:') related.push('pt-safe', 'pb-safe', 'px-safe')
    if (item.className === 'tabbar-present:') related.push('pb-tabbar-safe', 'h-tabbar')
    if (item.className === 'keyboard-open:') related.push('pb-safe', 'h-control')
  } else if (item.category === 'layout') {
    related.push('px-page', 'py-section', 'p-card')
    if (item.className === 'px-page') related.push('py-section', 'gap-section')
    if (item.className === 'py-section' || item.className === 'gap-section') related.push('px-page', 'p-card')
    if (item.className === 'p-card' || item.className === 'gap-card') related.push('rounded-card', 'bg-surface', 'shadow-card')
    if (item.className === 'h-nav') related.push('pt-nav-safe', 'px-page')
    if (item.className === 'h-tabbar') related.push('pb-tabbar-safe', 'px-page')
  } else if (item.category === 'control') {
    related.push('rounded-control', 'min-h-touch')
    if (item.className.startsWith('h-control')) related.push('bg-primary', 'text-on-primary', 'pressed:')
    if (item.className === 'min-h-touch') related.push('h-control', 'pressed:')
  } else if (item.category === 'shape') {
    related.push('bg-surface', 'shadow-card')
  } else if (item.category === 'color') {
    related.push('rounded-control', 'bg-surface')
    if (item.className === 'bg-primary') related.push('text-on-primary', 'rounded-control', 'pressed:')
    if (item.className === 'bg-surface') related.push('rounded-card', 'shadow-card', 'text-primary')
    if (item.className === 'text-primary' || item.className === 'text-muted') related.push('bg-surface')
  } else if (item.category === 'shadow') {
    related.push('bg-surface', 'rounded-card')
  } else if (item.category === 'wechat-safe-area') {
    related.push('px-page', 'pb-safe', 'pb-tabbar-safe', 'pt-safe', 'pt-nav-safe')
  } else if (item.category === 'wechat-hairline') {
    related.push('bg-surface', 'px-page')
  }

  return [...new Set(related)].filter((className) => className !== item.className)
}

function getUsageSteps(item: DocItem) {
  if (item.kind === 'variant') {
    return [
      '把它写在前面，后面跟具体原子，不要单独使用。',
      '优先叠加透明度、位移、safe-area 或颜色类，保持状态变化单一清楚。',
      '先确认当前平台真的存在这个上下文，再写进业务模板。',
    ]
  }

  if (item.category === 'layout') {
    if (item.className === 'px-page') {
      return ['放在页面主容器，先建立统一左右留白。', '页面内部模块再用 py-section 或 gap-section 拉开垂直节奏。', '不要把页面留白和卡片内边距写在同一层容器上。']
    }
    if (item.className === 'py-section' || item.className === 'gap-section') {
      return ['用于模块和模块之间的节奏，不用于按钮或小元素内部。', '整页都统一使用同一档节奏，局部再微调。', '通常与 px-page 搭配，先确定横向留白再确定纵向节奏。']
    }
    if (item.className === 'p-card' || item.className === 'gap-card') {
      return ['只管卡片内部信息组织，不承担页面整体留白。', '内容区一般再配 rounded-card、bg-surface、shadow-card。', '列表卡片尽量统一一套内边距，不要一张卡一种大小。']
    }
    if (item.className === 'h-nav' || item.className === 'h-tabbar') {
      return ['只定义结构高度，再按需要叠加安全区原子。', '沉浸式页面优先组合 pt-nav-safe 或 pb-tabbar-safe。', '导航区和内容区分层处理，不要直接把内容 padding 写进导航高度层。']
    }
  }

  if (item.category === 'control') {
    return ['先确定控件高度，再决定圆角、背景和状态。', '可点击区域至少满足 min-h-touch，再根据视觉层级选 h-control-*。', '主按钮通常组合 rounded-control、bg-primary、text-on-primary、pressed:*。']
  }

  if (item.category === 'shape') {
    return ['先用它建立形状，再补背景和阴影。', '卡片和控件的圆角不要混用，保持层级和语义稳定。', '一页里尽量控制圆角档位，不要出现太多半径。']
  }

  if (item.category === 'color') {
    return ['颜色原子只解决语义颜色，不负责布局和尺寸。', '主色背景优先配 text-on-primary，白底容器优先配 text-primary。', '页面大面积底色与卡片表面层尽量分开，避免层级不清。']
  }

  if (item.category === 'shadow') {
    return ['阴影只用来表达层级，不要每个容器都加。', '普通信息卡优先 shadow-card，浮层或强调面板再用 shadow-elevated。', '阴影通常和 bg-surface、rounded-card 一起出现。']
  }

  if (item.category === 'wechat-safe-area') {
    return ['先判断页面是顶部沉浸式还是底部吸底式，再选对应 safe-area 原子。', '安全区原子只负责避让，不替代页面留白。', '与 px-page、h-nav、h-tabbar 组合时，先定结构高度，再补安全区。']
  }

  if (item.category === 'wechat-hairline') {
    return ['优先用于浅分隔和边界，不要承担强视觉边框。', '列表里通常只保留一侧 hairline，避免多边重复发灰。', '与 bg-surface 配合时层级最自然。']
  }

  return ['先用它解决一个问题，再叠加其他原子。', '保持布局、尺寸、颜色、状态分层组合。', '如果需要更完整的起步结构，先去常用组合页复制。']
}

function getSizingNotes(item: DocItem) {
  let notes: Record<string, string[]> = {
    'px-page': [
      `comfortable 默认页边距是 ${comfortableTokens.layout.page}，compact ${compactTokens.layout.page}，spacious ${spaciousTokens.layout.page}。`,
      '它适合页面主容器，不适合卡片内部。',
    ],
    'py-section': [
      `模块默认节奏是 ${comfortableTokens.layout.section}，用于区块之间，不用于按钮或输入框内部。`,
      '整页统一这一档节奏，会比到处手写 margin 更稳。',
    ],
    'gap-section': [
      `建议把纵向 stack 的主间距统一到 ${comfortableTokens.layout.section}。`,
      '同层连续模块优先一套 gap，再局部覆盖。',
    ],
    'p-card': [
      `卡片默认内边距是 ${comfortableTokens.layout.card}。`,
      '卡片内距和页面留白分层处理，阅读节奏更稳定。',
    ],
    'gap-card': [
      `卡片内部元素默认间距也是 ${comfortableTokens.layout.card}。`,
      '适合标题、说明、按钮组的常规堆叠。',
    ],
    'h-nav': [
      `默认导航结构高度是 ${comfortableTokens.layout.nav}。`,
      '沉浸式头部通常再配 pt-nav-safe，而不是直接把安全区写死进高度。',
    ],
    'h-tabbar': [
      `默认底栏结构高度是 ${comfortableTokens.layout.tabbar}。`,
      '吸底区通常再配 pb-tabbar-safe，同步避让 tabbar 和底部安全区。',
    ],
    'h-control-xs': [`极小控件高度是 ${comfortableTokens.controlHeight.xs}。`, '只适合辅助操作或极简标签式交互，不适合主要按钮。'],
    'h-control-sm': [`紧凑控件高度是 ${comfortableTokens.controlHeight.sm}。`, '适合筛选条、次操作按钮、紧凑表单。'],
    'h-control': [`默认控件高度是 ${comfortableTokens.controlHeight.md}。`, `如果没有特别理由，优先从这一档开始。`],
    'h-control-lg': [`强调控件高度是 ${comfortableTokens.controlHeight.lg}。`, '适合主操作区和更强的点击可见性。'],
    'h-control-xl': [`超大控件高度是 ${comfortableTokens.controlHeight.xl}。`, '适合吸底主按钮和大尺寸操作面板，不建议日常列表滥用。'],
    'min-h-touch': [
      `最小触控热区是 ${comfortableTokens.layout.touch}。`,
      '它对应移动端点击热区下限思路，用来保证列表项、按钮和可点击块不难点。',
    ],
    'rounded-control': [
      `默认控件圆角是 ${comfortableTokens.radius.md}。`,
      '按钮、输入框、胶囊控件尽量统一这档圆角。',
    ],
    'rounded-card': [
      `默认卡片圆角是 ${comfortableTokens.radius.lg}。`,
      '信息卡、弹层、白底表面层比控件圆角更大一档，会更有层次。',
    ],
  }

  if (item.category === 'wechat-safe-area') {
    return ['安全区原子不是视觉尺寸规范，而是结构避让规范。', '顶部场景优先 pt-safe / pt-nav-safe，底部场景优先 pb-safe / pb-tabbar-safe。']
  }

  return notes[item.className] ?? null
}

function renderDetailList(items: string[]) {
  return `<ul class="detail-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function renderPreviewShell(body: string, note: string) {
  return `
    <div class="preview-card" style="${escapeHtml(previewThemeStyle)}">
      <div class="preview-frame">
        ${body}
      </div>
      <p class="preview-note">${escapeHtml(note)}</p>
    </div>
  `
}

function renderLayoutPreview(item: DocItem) {
  if (item.className === 'px-page') {
    return renderPreviewShell(
      `
        <div class="preview-phone">
          <div class="preview-screen preview-screen-page">
            <div class="preview-page-shell">
              <div class="preview-block preview-block-primary"></div>
              <div class="preview-card-surface">
                <div class="preview-line preview-line-strong"></div>
                <div class="preview-line"></div>
              </div>
              <div class="preview-block"></div>
            </div>
          </div>
        </div>
      `,
      '页面主容器先统一左右留白，再在内容层继续排卡片和模块。',
    )
  }

  if (item.className === 'py-section' || item.className === 'gap-section') {
    return renderPreviewShell(
      `
        <div class="preview-phone">
          <div class="preview-screen preview-screen-page">
            <div class="preview-page-shell preview-stack-section">
              <div class="preview-block preview-block-primary"></div>
              <div class="preview-block"></div>
              <div class="preview-block"></div>
            </div>
          </div>
        </div>
      `,
      '这一层控制的是模块和模块之间的主节奏，不是按钮或卡片内部的小间距。',
    )
  }

  if (item.className === 'p-card' || item.className === 'gap-card') {
    return renderPreviewShell(
      `
        <div class="preview-card-surface preview-card-surface-wide">
          <div class="preview-card-content">
            <div class="preview-line preview-line-strong"></div>
            <div class="preview-line"></div>
            <div class="preview-button preview-button-inline"></div>
          </div>
        </div>
      `,
      '卡片内边距和卡片内部元素间距要稳定，卡片之间的距离再交给 page / section 层。',
    )
  }

  if (item.className === 'h-nav') {
    return renderPreviewShell(
      `
        <div class="preview-phone">
          <div class="preview-screen">
            <div class="preview-nav-bar">
              <span class="preview-dot"></span>
              <div class="preview-line preview-line-short"></div>
              <span class="preview-dot"></span>
            </div>
            <div class="preview-page-shell">
              <div class="preview-block preview-block-primary"></div>
              <div class="preview-card-surface">
                <div class="preview-line preview-line-strong"></div>
                <div class="preview-line"></div>
              </div>
            </div>
          </div>
        </div>
      `,
      '导航高度先独立出来，沉浸式头部再叠加安全区原子。',
    )
  }

  if (item.className === 'h-tabbar') {
    return renderPreviewShell(
      `
        <div class="preview-phone">
          <div class="preview-screen preview-screen-tabbar">
            <div class="preview-page-shell">
              <div class="preview-block preview-block-primary"></div>
              <div class="preview-block"></div>
            </div>
            <div class="preview-tabbar">
              <span class="preview-tab"></span>
              <span class="preview-tab is-active"></span>
              <span class="preview-tab"></span>
            </div>
          </div>
        </div>
      `,
      '底栏高度先确定，再决定底部吸底操作区是否需要继续避让安全区。',
    )
  }

  return null
}

function renderControlPreview(item: DocItem) {
  if (item.className.startsWith('h-control')) {
    let size =
      item.className === 'h-control-xs'
        ? 'xs'
        : item.className === 'h-control-sm'
          ? 'sm'
          : item.className === 'h-control-lg'
            ? 'lg'
            : item.className === 'h-control-xl'
              ? 'xl'
              : 'md'
    return renderPreviewShell(
      `
        <div class="preview-surface-stack">
          <button class="preview-button" data-size="${size}">主要操作</button>
          <div class="preview-spec-row">
            <span>当前高度</span>
            <strong>${escapeHtml(
              size === 'xs'
                ? comfortableTokens.controlHeight.xs
                : size === 'sm'
                  ? comfortableTokens.controlHeight.sm
                  : size === 'lg'
                    ? comfortableTokens.controlHeight.lg
                    : size === 'xl'
                      ? comfortableTokens.controlHeight.xl
                      : comfortableTokens.controlHeight.md,
            )}</strong>
          </div>
        </div>
      `,
      '先定控件高度，再补圆角、颜色和状态，按钮层级会更统一。',
    )
  }

  if (item.className === 'min-h-touch') {
    return renderPreviewShell(
      `
        <div class="preview-touch-row">
          <div class="preview-touch-target">
            <div class="preview-line preview-line-strong"></div>
            <div class="preview-line preview-line-short"></div>
          </div>
          <div class="preview-touch-rule">min ${escapeHtml(comfortableTokens.layout.touch)}</div>
        </div>
      `,
      '触控热区比视觉元素本身更重要。先保点击面积，再谈视觉收紧。',
    )
  }

  return null
}

function renderShapePreview(item: DocItem) {
  if (item.className === 'rounded-card') {
    return renderPreviewShell(
      `
        <div class="preview-card-surface preview-card-surface-wide">
          <div class="preview-line preview-line-strong"></div>
          <div class="preview-line"></div>
          <div class="preview-line preview-line-short"></div>
        </div>
      `,
      '卡片圆角比控件圆角更大一档，层级会更自然。',
    )
  }

  if (item.className === 'rounded-control') {
    return renderPreviewShell(
      `
        <div class="preview-surface-stack">
          <button class="preview-button">主要按钮</button>
          <button class="preview-button preview-button-secondary">次操作</button>
        </div>
      `,
      '控件圆角适合按钮、输入框和胶囊控件，不建议和卡片圆角混用。',
    )
  }

  return null
}

function renderColorPreview(item: DocItem) {
  if (item.className === 'bg-primary' || item.className === 'text-on-primary') {
    return renderPreviewShell(
      `
        <div class="preview-surface-stack">
          <button class="preview-button">立即提交</button>
        </div>
      `,
      '主色层适合最重要的操作。主色背景里的文案优先配 text-on-primary。',
    )
  }

  if (item.className === 'bg-surface' || item.className === 'text-primary') {
    return renderPreviewShell(
      `
        <div class="preview-screen-card">
          <div class="preview-card-surface preview-card-surface-wide">
            <div class="preview-line preview-line-strong"></div>
            <div class="preview-line"></div>
            <div class="preview-line preview-line-short"></div>
          </div>
        </div>
      `,
      'surface 负责承载信息层，主文本颜色负责阅读层级。',
    )
  }

  if (item.className === 'bg-background') {
    return renderPreviewShell(
      `
        <div class="preview-phone">
          <div class="preview-screen preview-screen-background">
            <div class="preview-page-shell">
              <div class="preview-card-surface">
                <div class="preview-line preview-line-strong"></div>
                <div class="preview-line"></div>
              </div>
              <div class="preview-card-surface">
                <div class="preview-line preview-line-strong"></div>
                <div class="preview-line"></div>
              </div>
            </div>
          </div>
        </div>
      `,
      '页面背景和卡片表面层分开，层级才会清楚。',
    )
  }

  if (item.className === 'text-muted') {
    return renderPreviewShell(
      `
        <div class="preview-surface-stack">
          <div class="preview-line preview-line-strong"></div>
          <div class="preview-line preview-line-muted"></div>
          <div class="preview-line preview-line-muted preview-line-short"></div>
        </div>
      `,
      '辅助文本颜色只用于次级说明，不要承担主要信息。',
    )
  }

  if (item.className === 'border-default') {
    return renderPreviewShell(
      `
        <div class="preview-input"></div>
      `,
      '默认边框色适合输入框、卡片边界和轻分隔，不适合强强调。',
    )
  }

  return null
}

function renderShadowPreview(item: DocItem) {
  return renderPreviewShell(
    `
      <div class="preview-screen-card">
        <div class="preview-card-surface preview-card-surface-wide ${item.className === 'shadow-elevated' ? 'is-elevated' : ''}">
          <div class="preview-line preview-line-strong"></div>
          <div class="preview-line"></div>
          <div class="preview-line preview-line-short"></div>
        </div>
      </div>
    `,
    item.className === 'shadow-elevated' ? '更强的层级适合浮层和强调面板。' : '常规阴影适合信息卡，不要全页泛滥使用。',
  )
}

function renderWechatPreview(item: DocItem) {
  if (item.category === 'wechat-safe-area') {
    let modifier =
      item.className === 'pb-tabbar-safe'
        ? ' preview-safe-bottom-tabbar'
        : item.className === 'pt-nav-safe'
          ? ' preview-safe-top-nav'
          : item.className === 'pt-safe'
            ? ' preview-safe-top'
            : item.className === 'pb-safe'
              ? ' preview-safe-bottom'
              : item.className === 'px-safe'
                ? ' preview-safe-inline'
                : item.className === 'py-safe'
                  ? ' preview-safe-block'
                  : item.className === 'pl-safe'
                    ? ' preview-safe-left'
                    : item.className === 'pr-safe'
                      ? ' preview-safe-right'
                      : ''

    return renderPreviewShell(
      `
        <div class="preview-phone">
          <div class="preview-screen preview-screen-safe${modifier}">
            <div class="preview-notch"></div>
            <div class="preview-safe-content">
              <div class="preview-card-surface">
                <div class="preview-line preview-line-strong"></div>
                <div class="preview-line"></div>
              </div>
            </div>
            ${item.className === 'pb-tabbar-safe' ? '<div class="preview-tabbar"></div>' : ''}
          </div>
        </div>
      `,
      '安全区原子负责结构避让，不替代页面留白。预览里着色区域表示被预留出来的空间。',
    )
  }

  if (item.category === 'wechat-hairline') {
    let edge =
      item.className === 'hairline-t'
        ? 'is-top'
        : item.className === 'hairline-r'
          ? 'is-right'
          : item.className === 'hairline-b'
            ? 'is-bottom'
            : item.className === 'hairline-l'
              ? 'is-left'
              : 'is-all'
    return renderPreviewShell(
      `
        <div class="preview-card-surface preview-card-surface-wide preview-hairline ${edge}">
          <div class="preview-line preview-line-strong"></div>
          <div class="preview-line"></div>
        </div>
      `,
      '发丝线适合弱分隔和轻边界，用来提示层级，不适合做强轮廓。',
    )
  }

  return null
}

function renderVariantPreview(item: DocItem) {
  if (item.className === 'pressed:') {
    return renderPreviewShell(
      `
        <div class="preview-state-grid">
          <button class="preview-button preview-state-button">默认</button>
          <button class="preview-button preview-state-button is-pressed">按压</button>
        </div>
      `,
      '变体本身不是样式，它负责在某个状态上下文里激活后面的原子类。',
    )
  }

  if (item.className === 'disabled:') {
    return renderPreviewShell(
      `
        <div class="preview-state-grid">
          <button class="preview-button preview-state-button">可用</button>
          <button class="preview-button preview-state-button is-disabled">禁用</button>
        </div>
      `,
      '禁用态通常搭配透明度、文字颜色或边框变化一起出现。',
    )
  }

  return renderPreviewShell(
    `
      <div class="preview-context">
        <span class="preview-context-chip">${escapeHtml(item.className)}</span>
        <div class="preview-card-surface preview-card-surface-wide">
          <div class="preview-line preview-line-strong"></div>
          <div class="preview-line"></div>
        </div>
      </div>
    `,
    '这类原子提供的是上下文条件。实际视觉变化要看它和后续原子类如何组合。',
  )
}

function renderUtilityPreview(item: DocItem) {
  if (item.kind === 'variant') return renderVariantPreview(item)
  if (item.category === 'layout') return renderLayoutPreview(item)
  if (item.category === 'control') return renderControlPreview(item)
  if (item.category === 'shape') return renderShapePreview(item)
  if (item.category === 'color') return renderColorPreview(item)
  if (item.category === 'shadow') return renderShadowPreview(item)
  if (item.category.startsWith('wechat-')) return renderWechatPreview(item)
  return renderPreviewShell(
    `
      <div class="preview-card-surface preview-card-surface-wide">
        <div class="preview-line preview-line-strong"></div>
        <div class="preview-line"></div>
      </div>
    `,
    '这张预览卡用于帮助你先看尺寸和层级，最终值仍以代码输出为准。',
  )
}

async function loadIndex(): Promise<{ meta: DocIndexPayload; items: DocItem[] }> {
  let payload = docIndex as DocIndexPayload
  return {
    meta: payload,
    items: payload.items.map(toDocItem),
  }
}

function isRouteId(value: string): value is RouteId {
  return (
    value === 'overview' ||
    value === 'foundations' ||
    value === 'guides' ||
    value === 'browse' ||
    value === 'recipes' ||
    value === 'catalog' ||
    value === 'faq'
  )
}

function getHashState(): DocsHashState {
  let rawHash = window.location.hash.replace(/^#/, '')
  let [rawPath, rawSearch = ''] = rawHash.split('?')
  let pathValue = rawPath.replace(/^\//, '').trim()
  let route = isRouteId(pathValue) ? pathValue : 'overview'
  let search = new URLSearchParams(rawSearch)
  let platform = search.get('platform')

  return {
    route,
    query: search.get('q') ?? '',
    platform: platform === 'mobile' || platform === 'wechat-miniprogram' ? platform : 'all',
    category: search.get('category')?.trim() || 'all',
    selected: search.get('selected')?.trim() || '',
  }
}

function setHashState(state: DocsHashState) {
  let params = new URLSearchParams()
  if (state.query) params.set('q', state.query)
  if (state.platform !== 'all') params.set('platform', state.platform)
  if (state.category !== 'all') params.set('category', state.category)
  if (state.selected) params.set('selected', state.selected)
  let routePart = state.route === 'overview' ? '/' : `/${state.route}`
  let target = `#${routePart}${params.size > 0 ? `?${params.toString()}` : ''}`
  if (window.location.hash !== target) {
    ignoreNextHashChange = true
    window.location.hash = target
  }
}

function createSearchContext(query: string): SearchContext {
  let normalizedQuery = normalizeTimcssIntentQuery(query)
  let terms = splitTimcssSearchTerms(normalizedQuery)
  let intentMode = isTimcssIntentQuery(query)
  let intentTerms = expandTimcssIntentTerms(normalizedQuery)
  return {
    normalizedQuery,
    terms,
    intentMode,
    intentTerms,
    highlightQuery: normalizedQuery || query.trim().toLowerCase(),
  }
}

function scoreKeyword(item: DocItem, search: SearchContext) {
  let score = 0
  let className = item.className.toLowerCase()
  let intent = item.intent.toLowerCase()
  let whenToUse = item.whenToUse.toLowerCase()
  let output = item.output.toLowerCase()
  let description = item.description.toLowerCase()

  if (includesTimcssTerm(className, search.normalizedQuery)) score += 110
  if (includesTimcssTerm(intent, search.normalizedQuery)) score += 80
  if (includesTimcssTerm(whenToUse, search.normalizedQuery)) score += 70
  if (includesTimcssTerm(description, search.normalizedQuery)) score += 55
  if (includesTimcssTerm(output, search.normalizedQuery)) score += 35

  for (let term of search.terms) {
    if (includesTimcssTerm(className, term)) score += 34
    if (includesTimcssTerm(intent, term)) score += 28
    if (includesTimcssTerm(whenToUse, term)) score += 24
    if (includesTimcssTerm(description, term)) score += 18
    if (item.tags.some((tag) => includesTimcssTerm(tag, term))) score += 12
  }

  if (item.status === 'stable') score += 4
  return score
}

function scoreIntent(item: DocItem, search: SearchContext) {
  let score = 0
  let className = item.className.toLowerCase()
  let intent = item.intent.toLowerCase()
  let whenToUse = item.whenToUse.toLowerCase()

  if (includesTimcssTerm(intent, search.normalizedQuery)) score += 90
  if (includesTimcssTerm(whenToUse, search.normalizedQuery)) score += 80
  if (includesTimcssTerm(className, search.normalizedQuery)) score += 45

  for (let term of search.intentTerms) {
    if (includesTimcssTerm(intent, term)) score += 34
    if (includesTimcssTerm(whenToUse, term)) score += 28
    if (includesTimcssTerm(className, term)) score += 20
  }

  return score
}

function getCompositionSuggestion(item: DocItem) {
  if (item.kind === 'variant') return '推荐和 opacity、translate、safe-area、spacing 等原子类组合，而不是单独使用。'
  if (item.category === 'layout') return '先用它搭布局骨架，再叠加背景、圆角、阴影和文本颜色。'
  if (item.category === 'control') return '通常和 rounded-control、bg-primary、text-on-primary、pressed:* 一起出现。'
  if (item.category.startsWith('wechat-')) return '优先在原生微信小程序页面中使用，并与 px-page、safe/notch 相关能力配合。'
  return '保持原子组合思维：布局、颜色、形状、状态分层叠加。'
}

function formatGeneratedAt(value: string) {
  let date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function captureInputFocusSnapshot(): InputFocusSnapshot | null {
  let active = document.activeElement
  if (!(active instanceof HTMLInputElement)) return null
  if (active.id !== 'search-input' && active.id !== 'palette-input') return null
  return {
    id: active.id,
    selectionStart: active.selectionStart,
    selectionEnd: active.selectionEnd,
  }
}

function restoreInputFocusSnapshot(root: ParentNode, snapshot: InputFocusSnapshot | null) {
  if (!snapshot) return
  let input = root.querySelector<HTMLInputElement>(`#${snapshot.id}`)
  if (!input) return
  input.focus()
  if (snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
    input.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
  }
}

function getIndexNotice(meta: DocIndexPayload) {
  let generatedAt = new Date(meta.generatedAt)
  if (Number.isNaN(generatedAt.getTime())) {
    return '索引时间不可解析。如你刚修改版本号或包元数据，请先执行 pnpm run timcss:docs:generate。'
  }
  if (Date.now() - generatedAt.getTime() > staleIndexThresholdMs) {
    return '当前索引生成时间较早。若源码或包元数据已更新，请先重新生成 docs 索引。'
  }
  return '当前页面直接消费 docs 索引文件，搜索结果与原子项清单保持同源。'
}

function renderRouteNav(route: RouteId) {
  return (Object.keys(routeLabels) as RouteId[])
    .map(
      (item) =>
        `<button class="topbar-link ${route === item ? 'is-active' : ''}" data-route="${item}">${escapeHtml(routeLabels[item])}</button>`,
    )
    .join('')
}

function getAdjacentRoutes(route: RouteId) {
  let index = routeOrder.indexOf(route)
  return {
    previous: index > 0 ? routeOrder[index - 1] : null,
    next: index >= 0 && index < routeOrder.length - 1 ? routeOrder[index + 1] : null,
  }
}

function renderPager(route: RouteId) {
  let adjacent = getAdjacentRoutes(route)
  if (!adjacent.previous && !adjacent.next) return ''
  return `
    <section class="section-block pager-block">
      <div class="pager">
        ${
          adjacent.previous
            ? `<button class="pager-link" data-route="${adjacent.previous}"><span>上一页</span><strong>${escapeHtml(routeLabels[adjacent.previous])}</strong></button>`
            : `<div></div>`
        }
        ${
          adjacent.next
            ? `<button class="pager-link pager-link-next" data-route="${adjacent.next}"><span>下一页</span><strong>${escapeHtml(routeLabels[adjacent.next])}</strong></button>`
            : `<div></div>`
        }
      </div>
    </section>
  `
}

function renderGuideCard(guide: Guide) {
  return `
    <article class="guide-card">
      <div class="guide-title-row">
        <h3>${escapeHtml(guide.title)}</h3>
        <span class="guide-badge ${guide.status === '已验证' ? 'is-verified' : 'is-caution'}">${escapeHtml(guide.status)}</span>
      </div>
      <p class="guide-summary">${escapeHtml(guide.summary)}</p>
      <ol class="guide-steps">
        ${guide.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
      </ol>
      <div class="mini-heading">最小配置</div>
      <pre class="code-block"><code>${escapeHtml(guide.config)}</code></pre>
      <div class="mini-heading">常用命令</div>
      <pre class="code-block"><code>${escapeHtml(guide.commands.join('\n'))}</code></pre>
      <div class="guide-actions">
        <button class="inline-btn" data-guide-platform="${guide.platform}" data-guide-query="${guide.platform === 'wechat-miniprogram' ? '底部安全区 吸底' : '按钮高度 触控'}">按这条路径开始搜索</button>
      </div>
    </article>
  `
}

function renderFaqList() {
  return faqs
    .map(
      (faq) => `
        <details class="faq-item">
          <summary>${escapeHtml(faq.question)}</summary>
          <p>${escapeHtml(faq.answer)}</p>
        </details>
      `,
    )
    .join('')
}

function renderResultCard(item: DocItem, search: SearchContext, selected: boolean) {
  return `
    <button class="utility-card ${selected ? 'is-active' : ''}" data-select="${item.id}">
      <div class="utility-card-top">
        <code>${highlight(item.className, search.highlightQuery)}</code>
        <span class="utility-status ${item.status === 'stable' ? 'is-stable' : 'is-experimental'}">${item.status === 'stable' ? '稳定' : '实验'}</span>
      </div>
      <div class="utility-intent">${highlight(item.intent, search.highlightQuery)}</div>
      <div class="utility-when">${highlight(item.whenToUse, search.highlightQuery)}</div>
      <div class="tag-row">
        ${item.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
    </button>
  `
}

function renderApp(meta: DocIndexPayload, items: DocItem[]) {
  let initialState = getHashState()
  let query = initialState.query
  let activePlatform: 'all' | PlatformTag = initialState.platform
  let activeCategory = initialState.category
  let selectedId = initialState.selected || (items.find((item) => item.status === 'stable')?.id ?? items[0]?.id ?? '')
  let copiedValue = ''
  let route = initialState.route
  let paletteOpen = false
  let paletteQuery = ''
  let drawerOpen = false

  let app = document.querySelector<HTMLDivElement>('#app')
  if (!app) throw new Error('Missing #app container')

  function filterItems(search: SearchContext) {
    let visible = items.filter((item) => {
      let byPlatform = activePlatform === 'all' || item.platforms.includes(activePlatform)
      let byCategory = activeCategory === 'all' || item.category === activeCategory
      return byPlatform && byCategory
    })

    if (!search.normalizedQuery) {
      return [...visible].sort((left, right) => {
        if (left.status !== right.status) return left.status === 'stable' ? -1 : 1
        let leftIndex = categoryOrder.indexOf(left.category as (typeof categoryOrder)[number])
        let rightIndex = categoryOrder.indexOf(right.category as (typeof categoryOrder)[number])
        if (leftIndex !== rightIndex) return leftIndex - rightIndex
        return left.className.localeCompare(right.className)
      })
    }

    return visible
      .map((item) => {
        let keywordScore = scoreKeyword(item, search)
        let intentScore = scoreIntent(item, search)
        let score = search.intentMode ? keywordScore * 0.55 + intentScore : keywordScore + intentScore * 0.35
        return { item, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (left.score !== right.score) return right.score - left.score
        if (left.item.status !== right.item.status) return left.item.status === 'stable' ? -1 : 1
        return left.item.className.localeCompare(right.item.className)
      })
      .map((entry) => entry.item)
  }

  function getRecommendedRecipes(search: SearchContext, visible: DocItem[]) {
    if (!search.normalizedQuery) return []
    let visibleClasses = new Set(visible.map((item) => item.className))
    return recipes
      .filter((recipe) => {
        if (activePlatform === 'all') return true
        return recipe.platforms.includes('all') || recipe.platforms.includes(activePlatform)
      })
      .map((recipe) => {
        let availableClasses = recipe.classes.filter((className) => visibleClasses.has(className))
        if (availableClasses.length === 0) return null
        let score = 0
        for (let hint of recipe.queryHints) {
          if (search.normalizedQuery.includes(hint.toLowerCase())) score += 60
        }
        for (let term of search.intentTerms) {
          if (includesTimcssTerm(recipe.title, term)) score += 24
          if (includesTimcssTerm(recipe.description, term)) score += 20
          if (availableClasses.some((className) => includesTimcssTerm(className, term))) score += 18
        }
        if (score === 0) return null
        return {
          ...recipe,
          score,
          classString: availableClasses.join(' '),
        }
      })
      .filter((recipe): recipe is NonNullable<typeof recipe> => recipe !== null)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
  }

  function getSelected(visible: DocItem[]) {
    return visible.find((item) => item.id === selectedId) ?? visible[0] ?? null
  }

  function copyText(text: string) {
    copiedValue = text
    navigator.clipboard.writeText(text).catch(() => {})
    render()
    window.setTimeout(() => {
      if (copiedValue === text) {
        copiedValue = ''
        render()
      }
    }, 1200)
  }

  function openCatalogSearch(nextQuery: string, platform: 'all' | PlatformTag = 'all') {
    query = nextQuery
    activePlatform = platform
    route = 'catalog'
    paletteOpen = false
    drawerOpen = false
    render()
  }

  function openCategoryBrowse(category: string, platform: 'all' | PlatformTag = activePlatform) {
    activeCategory = category
    activePlatform = platform
    route = 'catalog'
    paletteOpen = false
    drawerOpen = false
    render()
  }

  function createSelectedUtilityLink(selected: DocItem | null) {
    if (!selected) return window.location.href
    let params = new URLSearchParams()
    if (query) params.set('q', query)
    if (activePlatform !== 'all') params.set('platform', activePlatform)
    if (activeCategory !== 'all') params.set('category', activeCategory)
    params.set('selected', selected.id)
    return `${window.location.origin}${window.location.pathname}#/catalog?${params.toString()}`
  }

  function getPaletteCommands(search: SearchContext, visible: DocItem[]): CommandItem[] {
    let commands: CommandItem[] = [
      {
        id: 'route-overview',
        title: '前往总览',
        subtitle: '查看定位、原则和索引状态',
        keywords: ['overview', '总览', '首页'],
        action() {
          route = 'overview'
          paletteOpen = false
          render()
        },
      },
      {
        id: 'route-guides',
        title: '前往开始使用',
        subtitle: '查看 H5、小程序和 Taro / uni-app 接入方式',
        keywords: ['guides', '开始使用', '接入'],
        action() {
          route = 'guides'
          paletteOpen = false
          render()
        },
      },
      {
        id: 'route-foundations',
        title: '前往尺寸基础',
        subtitle: '查看移动端尺寸、触控热区和布局节奏',
        keywords: ['foundations', '尺寸', 'spacing', 'touch', '触控', 'rpx'],
        action() {
          route = 'foundations'
          paletteOpen = false
          render()
        },
      },
      {
        id: 'route-catalog',
        title: '前往原子检索',
        subtitle: '按问题、类名和意图搜索原子类',
        keywords: ['catalog', '原子', '搜索'],
        action() {
          route = 'catalog'
          paletteOpen = false
          render()
        },
      },
      {
        id: 'route-browse',
        title: '前往分类浏览',
        subtitle: '按布局、控件、安全区、状态等分类浏览原子',
        keywords: ['browse', '分类', '浏览', 'layout', 'control'],
        action() {
          route = 'browse'
          paletteOpen = false
          render()
        },
      },
      {
        id: 'route-recipes',
        title: '前往常用组合',
        subtitle: '查看可直接复用的移动端原子组合 recipes',
        keywords: ['recipes', '组合', 'recipe', '搭配'],
        action() {
          route = 'recipes'
          paletteOpen = false
          render()
        },
      },
      {
        id: 'route-faq',
        title: '前往 FAQ',
        subtitle: '查看常见问题与支持边界',
        keywords: ['faq', '问题', '边界'],
        action() {
          route = 'faq'
          paletteOpen = false
          render()
        },
      },
      ...quickSearches.map((item) => ({
        id: `search-${item}`,
        title: `搜索：${item}`,
        subtitle: '直接带着场景词进入原子检索',
        keywords: ['search', '搜索', item],
        action() {
          openCatalogSearch(item)
        },
      })),
      ...categoryOrder.map((category) => ({
        id: `category-${category}`,
        title: `浏览分类：${categoryLabels[category] ?? category}`,
        subtitle: `查看 ${(items.filter((item) => item.category === category)).length} 个相关原子`,
        keywords: ['分类', 'category', category, categoryLabels[category] ?? category],
        action() {
          route = 'browse'
          activeCategory = category
          paletteOpen = false
          render()
        },
      })),
      ...recipes.map((recipe) => ({
        id: `recipe-${recipe.id}`,
        title: `组合：${recipe.title}`,
        subtitle: recipe.description,
        keywords: ['recipe', '组合', recipe.title, recipe.description, ...recipe.classes],
        action() {
          route = 'recipes'
          paletteOpen = false
          render()
        },
      })),
      ...guides.map((guide) => ({
        id: `guide-${guide.id}`,
        title: `查看：${guide.title}`,
        subtitle: guide.summary,
        keywords: ['guide', guide.title, guide.summary, guide.platform],
        action() {
          route = 'guides'
          paletteOpen = false
          render()
        },
      })),
      ...visible.slice(0, 8).map((item) => ({
        id: `utility-${item.id}`,
        title: `原子：${item.className}`,
        subtitle: item.intent,
        keywords: [item.className, item.intent, item.whenToUse, ...item.tags],
        action() {
          selectedId = item.id
          openCatalogSearch(query || item.className, activePlatform)
        },
      })),
    ]

    let normalizedPalette = normalizeTimcssIntentQuery(paletteQuery)
    if (!normalizedPalette) return commands.slice(0, 12)

    return commands
      .map((item) => {
        let haystack = `${item.title} ${item.subtitle} ${item.keywords.join(' ')}`.toLowerCase()
        let score = includesTimcssTerm(haystack, normalizedPalette) ? 100 : 0
        for (let term of splitTimcssSearchTerms(normalizedPalette)) {
          if (includesTimcssTerm(haystack, term)) score += 24
        }
        return { item, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.item)
      .slice(0, 10)
  }

  function renderOverviewPage() {
    return `
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">TimCSS Docs</p>
          <h1>先定移动端规则，再选原子。</h1>
          <p class="hero-text">这里优先回答原子类怎么用、尺寸怎么定、安全区怎么避让，而不是只给你一张 class 名单。</p>
          <div class="proof-strip">
            <span class="proof-pill">全部原子类</span>
            <span class="proof-pill">移动端尺寸体系</span>
            <span class="proof-pill">微信小程序避让规则</span>
            <span class="proof-pill">原子组合建议</span>
          </div>
          <div class="hero-actions">
            <button class="primary-link button-link" data-route="foundations">先看尺寸基础</button>
            <button class="ghost-link button-link" data-route="catalog">开始搜索原子</button>
          </div>
        </div>
        <div class="hero-side">
          <div class="summary-card">
            <div class="summary-title">这站重点</div>
            <ul class="summary-list">
              <li>每个原子都给出作用、用法、搭配与最小示例</li>
              <li>尺寸基础页先讲清楚 page / section / card / control / safe-area</li>
              <li>官方验证平台：移动端 H5、原生微信小程序</li>
            </ul>
          </div>
          <div class="summary-stats">
            <div><span>原子总数</span><strong>${items.length}</strong></div>
            <div><span>TimCSS 版本</span><strong>${escapeHtml(meta.packageVersion)}</strong></div>
            <div><span>索引生成</span><strong>${escapeHtml(formatGeneratedAt(meta.generatedAt))}</strong></div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <p class="eyebrow">Start Here</p>
          <h2>先选路径。</h2>
          <p>第一次进站，先看尺寸基础；已经有问题场景时，直接进原子检索。</p>
        </div>
        <div class="path-grid">
          ${overviewPaths
            .map(
              (path) => `
                <article class="path-card">
                  <div class="summary-title">推荐路径</div>
                  <h3>${escapeHtml(path.title)}</h3>
                  <p>${escapeHtml(path.summary)}</p>
                  <button class="inline-btn" data-route="${path.route}">${escapeHtml(path.actionLabel)}</button>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <p class="eyebrow">What Matters</p>
          <h2>文档主线是原子，不是概念堆叠。</h2>
          <p>所有页面都围绕使用场景、尺寸规则和复制落地来组织。</p>
        </div>
        <div class="principle-grid">
          <article class="principle-card"><h3>先讲尺寸</h3><p>把页面留白、控件高度、触控热区和安全区先讲透，再落到原子类。</p></article>
          <article class="principle-card"><h3>再讲用法</h3><p>每个原子都解释作用、何时用、怎么搭，而不是只有 class 名。</p></article>
          <article class="principle-card"><h3>最后给示例</h3><p>原子详情页直接给最小示例和相关原子，方便复制和继续扩展。</p></article>
          <article class="principle-card"><h3>平台边界写清</h3><p>H5 与微信小程序能力分开写，避免把“可接入”误当成“已验证”。</p></article>
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <p class="eyebrow">Quick Start</p>
          <h2>常用入口</h2>
        </div>
        <div class="overview-actions">
          <button class="shortcut-chip" data-route="foundations">看尺寸基础</button>
          ${quickSearches
            .map(
              (item) =>
                `<button class="shortcut-chip" data-search-chip="${escapeHtml(item)}">搜索 ${escapeHtml(item)}</button>`,
            )
            .join('')}
          <button class="shortcut-chip" data-route="guides">查看接入路径</button>
        </div>
      </section>

      <section class="section-block notice-block">
        <div class="notice-card">
          <h2>索引状态</h2>
          <p>${escapeHtml(getIndexNotice(meta))}</p>
          <div class="notice-tags">
            <span class="tag">TimCSS ${escapeHtml(meta.packageVersion)}</span>
            <span class="tag">schema ${escapeHtml(meta.schemaVersion)}</span>
            <span class="tag">生成于 ${escapeHtml(formatGeneratedAt(meta.generatedAt))}</span>
          </div>
        </div>
      </section>
    `
  }

  function renderFoundationsPage() {
    return `
      <section class="section-block route-hero">
        <div class="route-hero-shell">
          <div class="section-head route-head">
            <p class="eyebrow">Foundations</p>
            <h2>这页先讲移动端尺寸规则。</h2>
            <p>先确定 page、section、card、control 和 safe-area 的基准，再去选具体原子类，页面会更整齐，也更容易维护。</p>
          </div>
          <aside class="route-aside">
            <div class="summary-title">这页优先看</div>
            <strong>8rpx 基准、触控热区、控件高度、安全区避让</strong>
            <p>如果你在设计尺寸、按钮高度和页面留白，这页应该先看。</p>
          </aside>
        </div>

        <div class="foundation-grid">
          ${foundationScales
            .map(
              (scale) => `
                <article class="foundation-card">
                  <div class="summary-title">核心基准</div>
                  <h3>${escapeHtml(scale.title)}</h3>
                  <div class="foundation-value">${escapeHtml(scale.value)}</div>
                  <p>${escapeHtml(scale.detail)}</p>
                  <div class="tag-row">
                    ${scale.classes.map((className) => `<button class="tag tag-button" data-search-chip="${escapeHtml(className)}">${escapeHtml(className)}</button>`).join('')}
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>

        <div class="foundation-layout">
          <article class="notice-card">
            <h2>尺寸使用顺序</h2>
            ${renderDetailList([
              `页面根容器先用 px-page，comfortable 默认是 ${comfortableTokens.layout.page}。`,
              `模块节奏优先用 py-section 或 gap-section，comfortable 默认是 ${comfortableTokens.layout.section}。`,
              `卡片内部优先用 p-card 或 gap-card，comfortable 默认是 ${comfortableTokens.layout.card}。`,
              `可点击区域至少满足 min-h-touch，comfortable 默认是 ${comfortableTokens.layout.touch}。`,
              '顶部沉浸式场景优先用 pt-safe / pt-nav-safe，底部吸底场景优先用 pb-safe / pb-tabbar-safe。',
            ])}
          </article>
          <article class="notice-card">
            <h2>密度怎么选</h2>
            ${renderDetailList([
              `compact 更适合信息密度高的业务页：page ${compactTokens.layout.page}，touch ${compactTokens.layout.touch}。`,
              `comfortable 适合作为默认方案：page ${comfortableTokens.layout.page}，touch ${comfortableTokens.layout.touch}。`,
              `spacious 更适合首屏营销、强操作和高可读页面：page ${spaciousTokens.layout.page}，touch ${spaciousTokens.layout.touch}。`,
              '整页优先保持同一套 density，不要每个模块各用一套尺寸节奏。',
            ])}
          </article>
        </div>

        <div class="section-block">
          <div class="section-head">
            <p class="eyebrow">Quick Mapping</p>
            <h2>常见问题该先看哪些原子</h2>
            <p>先从问题出发，再进入原子检索页拿单个类和最小示例。</p>
          </div>
          <div class="foundation-grid foundation-grid-tight">
            <article class="foundation-card">
              <h3>页面整体留白不稳</h3>
              <p>先统一页面横向留白，再决定区块节奏。</p>
              <div class="tag-row">
                <button class="tag tag-button" data-search-chip="px-page">px-page</button>
                <button class="tag tag-button" data-search-chip="py-section">py-section</button>
                <button class="tag tag-button" data-search-chip="gap-section">gap-section</button>
              </div>
            </article>
            <article class="foundation-card">
              <h3>按钮和列表点击区域太小</h3>
              <p>先保热区，再选控件高度档位。</p>
              <div class="tag-row">
                <button class="tag tag-button" data-search-chip="min-h-touch">min-h-touch</button>
                <button class="tag tag-button" data-search-chip="h-control">h-control</button>
                <button class="tag tag-button" data-search-chip="rounded-control">rounded-control</button>
              </div>
            </article>
            <article class="foundation-card">
              <h3>吸底区被 tabbar 或安全区挡住</h3>
              <p>先做结构避让，再叠主按钮和颜色。</p>
              <div class="tag-row">
                <button class="tag tag-button" data-search-chip="pb-tabbar-safe">pb-tabbar-safe</button>
                <button class="tag tag-button" data-search-chip="pb-safe">pb-safe</button>
                <button class="tag tag-button" data-search-chip="h-tabbar">h-tabbar</button>
              </div>
            </article>
          </div>
        </div>
      </section>
    `
  }

  function renderGuidesPage() {
    return `
      <section class="section-block route-hero">
        <div class="route-hero-shell">
          <div class="section-head route-head">
            <p class="eyebrow">Get Started</p>
            <h2>这页只解决接入问题。</h2>
            <p>先选平台，再复制最小配置和第一条命令。</p>
          </div>
          <aside class="route-aside">
            <div class="summary-title">你会得到</div>
            <strong>最小配置 + 第一条检查命令</strong>
            <p>接入完成后，再去检索页找原子。</p>
          </aside>
        </div>
        <div class="guide-grid">
          ${guides.map(renderGuideCard).join('')}
        </div>
      </section>
    `
  }

  function renderBrowsePage() {
    let browseCategories = categoryOrder.filter((category) => items.some((item) => item.category === category))
    let visibleItems = items.filter((item) => activePlatform === 'all' || item.platforms.includes(activePlatform))

    return `
      <section class="section-block route-hero">
        <div class="route-hero-shell">
          <div class="section-head route-head">
            <p class="eyebrow">Browse</p>
            <h2>这页按能力分类浏览。</h2>
            <p>不知道类名时，从布局、控件、安全区、发丝线和状态开始看。</p>
          </div>
          <aside class="route-aside">
            <div class="summary-title">适合场景</div>
            <strong>知道问题类型，不知道类名</strong>
            <p>先缩小范围，再进入检索页或直接点原子。</p>
          </aside>
        </div>
        <div class="filter-row browse-filter-row">
          <div class="filter-group">
            ${(['all', 'mobile', 'wechat-miniprogram'] as const)
              .map(
                (platform) =>
                  `<button class="filter-chip ${activePlatform === platform ? 'is-active' : ''}" data-platform="${platform}">${escapeHtml(platformLabels[platform])}</button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="browse-grid">
          ${browseCategories
            .map((category) => {
              let categoryItems = visibleItems.filter((item) => item.category === category)
              let preview = categoryItems.slice(0, 5)
              let stableCount = categoryItems.filter((item) => item.status === 'stable').length
              return `
                <article class="browse-card ${activeCategory === category ? 'is-active' : ''}">
                  <div class="browse-card-head">
                    <h3>${escapeHtml(categoryLabels[category] ?? category)}</h3>
                    <span class="tag">${categoryItems.length}</span>
                  </div>
                  <p class="browse-card-text">稳定 ${stableCount} 个 · 适合先从这一类能力里找可复用的原子组合。</p>
                  <div class="browse-preview">
                    ${preview.map((item) => `<button class="browse-preview-chip" data-browse-select="${item.id}">${escapeHtml(item.className)}</button>`).join('')}
                  </div>
                  <div class="browse-actions">
                    <button class="inline-btn" data-browse-category="${category}">在检索页打开</button>
                    <button class="inline-btn" data-search-chip="${escapeHtml(categoryLabels[category] ?? category)}">按分类名搜索</button>
                  </div>
                </article>
              `
            })
            .join('')}
        </div>
      </section>
    `
  }

  function renderRecipesPage() {
    return `
      <section class="section-block route-hero">
        <div class="route-hero-shell">
          <div class="section-head route-head">
            <p class="eyebrow">Recipes</p>
            <h2>这页先给可用组合。</h2>
            <p>适合你不想从单个原子开始，想先拿到一套可靠搭配。</p>
          </div>
          <aside class="route-aside">
            <div class="summary-title">适合场景</div>
            <strong>先复制，再微调</strong>
            <p>组合不是组件库，只是起步模板。</p>
          </aside>
        </div>
        <div class="recipe-grid">
          ${recipes
            .map((recipe) => {
              let supportedPlatforms =
                recipe.platforms.includes('all')
                  ? 'H5 移动端 / 微信小程序'
                  : recipe.platforms.map((platform) => platformLabels[platform]).join(' / ')
              let classString = recipe.classes.join(' ')
              return `
                <article class="recipe-card">
                  <div class="guide-title-row">
                    <h3>${escapeHtml(recipe.title)}</h3>
                    <span class="tag">${escapeHtml(supportedPlatforms)}</span>
                  </div>
                  <p>${escapeHtml(recipe.description)}</p>
                  <pre class="code-block"><code>${escapeHtml(classString)}</code></pre>
                  <div class="tag-row">
                    ${recipe.queryHints.map((hint) => `<span class="tag">${escapeHtml(hint)}</span>`).join('')}
                  </div>
                  <div class="recipe-actions">
                    <button class="inline-btn" data-copy="${escapeHtml(classString)}">${copiedValue === classString ? '已复制' : '复制组合'}</button>
                    <button class="inline-btn" data-copy="${escapeHtml(`<view class="${classString}">组合示例</view>`)}">复制示例</button>
                    <button class="inline-btn" data-recipe-search="${escapeHtml(recipe.queryHints[0] ?? recipe.title)}">在检索页打开</button>
                  </div>
                </article>
              `
            })
            .join('')}
        </div>
      </section>
    `
  }

  function renderCatalogPage() {
    let search = createSearchContext(query)
    let visible = filterItems(search)
    let selected = getSelected(visible)
    if (selected) selectedId = selected.id
    let recipesForQuery = getRecommendedRecipes(search, visible)
    let categoryTabs = ['all', ...categoryOrder.filter((category) => items.some((item) => item.category === category))]

    let emptyState = `
      <div class="empty-card empty-search-card">
        <strong>没有找到结果。</strong>
        <p>你可以先换成问题词搜索，再放宽平台或分类筛选。</p>
        <div class="empty-actions">
          <button class="inline-btn" data-search-chip="底部安全区 吸底">试试：底部安全区</button>
          <button class="inline-btn" data-search-chip="按钮高度 触控">试试：按钮高度</button>
          <button class="inline-btn" data-reset-search>重置筛选</button>
        </div>
      </div>
    `

    return `
      <section class="section-block route-hero">
        <div class="route-hero-shell">
          <div class="section-head route-head">
            <p class="eyebrow">Search</p>
            <h2>这页只负责找原子。</h2>
            <p>先搜问题词，再看推荐组合，最后复制类名和示例。</p>
          </div>
          <aside class="route-aside">
            <div class="summary-title">最快方式</div>
            <strong>先搜“安全区”“按钮高度”“发丝线”</strong>
            <p>不确定类名时，先别猜 class。</p>
          </aside>
        </div>

        <div class="search-panel">
          <div class="search-steps">
            <span>1. 先搜问题</span>
            <span>2. 再看推荐组合</span>
            <span>3. 最后复制原子和示例</span>
          </div>
          <div class="search-box">
            <input id="search-input" type="search" placeholder="搜索 pb-safe / 发丝线 / 卡片，或 intent:底部安全区" value="${escapeHtml(query)}" />
            <button class="ghost-link-button" data-clear-search ${query ? '' : 'disabled'}>清空</button>
          </div>
          <div class="shortcut-row">
            ${quickSearches.map((entry) => `<button class="shortcut-chip" data-search-chip="${escapeHtml(entry)}">${escapeHtml(entry)}</button>`).join('')}
          </div>
          <div class="filter-row">
            <div class="filter-group">
              ${(['all', 'mobile', 'wechat-miniprogram'] as const)
                .map((platform) => `<button class="filter-chip ${activePlatform === platform ? 'is-active' : ''}" data-platform="${platform}">${escapeHtml(platformLabels[platform])}</button>`)
                .join('')}
            </div>
            <div class="filter-group">
              ${categoryTabs
                .map((category) => `<button class="filter-chip ${activeCategory === category ? 'is-active' : ''}" data-category="${category}">${escapeHtml(categoryLabels[category] ?? category)}</button>`)
                .join('')}
            </div>
          </div>
          <div class="search-meta">
            <span>当前模式：<strong>${search.intentMode ? '语义意图' : '关键词匹配'}</strong></span>
            <span>结果：<strong>${visible.length}</strong></span>
            <span>快捷键：<strong>/</strong> 聚焦搜索，<strong>⌘K / Ctrl+K</strong> 打开命令面板</span>
          </div>
          <div class="catalog-actions">
            <button class="inline-btn" data-copy-link>${copiedValue === window.location.href ? '已复制链接' : '复制当前检索链接'}</button>
            <button class="inline-btn" data-route="browse">按分类浏览</button>
          </div>
        </div>

        ${
          recipesForQuery.length > 0
            ? `
              <div class="recipe-grid">
                ${recipesForQuery
                  .map(
                    (recipe) => `
                      <article class="recipe-card">
                        <h3>${highlight(recipe.title, search.highlightQuery)}</h3>
                        <p>${highlight(recipe.description, search.highlightQuery)}</p>
                        <pre class="code-block"><code>${escapeHtml(recipe.classString)}</code></pre>
                        <div class="recipe-actions">
                          <button class="inline-btn" data-copy="${escapeHtml(recipe.classString)}">${copiedValue === recipe.classString ? '已复制' : '复制组合'}</button>
                          <button class="inline-btn" data-copy="${escapeHtml(`<view class="${recipe.classString}">组合示例</view>`)}">复制示例</button>
                        </div>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            `
            : ''
        }

        <div class="catalog-layout">
          <div class="results-panel">
            ${
              visible.length > 0
                ? visible.map((item) => renderResultCard(item, search, selected?.id === item.id)).join('')
                : emptyState
            }
          </div>
          <aside class="detail-panel">
            ${
              selected
                ? `
                  <div class="detail-head" id="detail-${escapeHtml(selected.id)}">
                    <div>
                      <p class="detail-kicker">${escapeHtml(selected.platforms.map((platform) => platformLabels[platform]).join(' / '))}</p>
                      <h3><code>${escapeHtml(selected.className)}</code></h3>
                    </div>
                    <button class="inline-btn" data-copy="${escapeHtml(selected.className)}">${copiedValue === selected.className ? '已复制' : '复制类名'}</button>
                  </div>
                  <div class="tag-row">
                    ${selected.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                  </div>
                  <div class="detail-block">
                    <div class="mini-heading">作用</div>
                    <p>${highlight(selected.intent, search.highlightQuery)}</p>
                  </div>
                  <div class="detail-block">
                    <div class="mini-heading">什么时候用</div>
                    <p>${highlight(selected.whenToUse, search.highlightQuery)}</p>
                  </div>
                  <div class="detail-block">
                    <div class="mini-heading">如何使用</div>
                    ${renderDetailList(getUsageSteps(selected))}
                  </div>
                  ${
                    getSizingNotes(selected)
                      ? `
                        <div class="detail-block">
                          <div class="mini-heading">尺寸与设计基准</div>
                          ${renderDetailList(getSizingNotes(selected) ?? [])}
                        </div>
                      `
                      : ''
                  }
                  <div class="detail-block">
                    <div class="mini-heading">推荐搭配</div>
                    <p>${escapeHtml(getCompositionSuggestion(selected))}</p>
                    <div class="tag-row detail-tag-row">
                      ${getRelatedClassNames(selected)
                        .map((className) => `<button class="tag tag-button" data-search-chip="${escapeHtml(className)}">${escapeHtml(className)}</button>`)
                        .join('')}
                    </div>
                  </div>
                  <div class="detail-block">
                    <div class="mini-heading">视觉预览</div>
                    ${renderUtilityPreview(selected)}
                  </div>
                  <div class="detail-block">
                    <div class="mini-heading">输出语义</div>
                    <pre class="code-block"><code>${highlight(selected.output, search.highlightQuery)}</code></pre>
                  </div>
                  <div class="detail-block">
                    <div class="mini-heading">最小示例</div>
                    <pre class="code-block"><code>${escapeHtml(selected.example)}</code></pre>
                  </div>
                  <div class="detail-actions">
                    <button class="inline-btn" data-copy="${escapeHtml(selected.example)}">复制示例</button>
                    <button class="inline-btn" data-copy-detail-link="${escapeHtml(createSelectedUtilityLink(selected))}">${copiedValue === createSelectedUtilityLink(selected) ? '已复制详情链接' : '复制详情链接'}</button>
                  </div>
                `
                : `<div class="empty-card"><strong>请选择一个原子类。</strong><p>左侧结果列表会根据搜索词实时更新。</p></div>`
            }
          </aside>
        </div>
      </section>
    `
  }

  function renderFaqPage() {
    return `
      <section class="section-block route-hero">
        <div class="route-hero-shell">
          <div class="section-head route-head">
            <p class="eyebrow">FAQ</p>
            <h2>这页集中看边界和排查。</h2>
            <p>支持什么，不支持什么，遇到问题先查这里。</p>
          </div>
          <aside class="route-aside">
            <div class="summary-title">优先阅读</div>
            <strong>平台边界、输出策略、搜索不到结果时怎么办</strong>
            <p>先看这里，再回到具体页面操作。</p>
          </aside>
        </div>
        <div class="faq-list">
          ${renderFaqList()}
        </div>
      </section>
    `
  }

  function renderPage() {
    if (route === 'foundations') return renderFoundationsPage()
    if (route === 'guides') return renderGuidesPage()
    if (route === 'browse') return renderBrowsePage()
    if (route === 'recipes') return renderRecipesPage()
    if (route === 'catalog') return renderCatalogPage()
    if (route === 'faq') return renderFaqPage()
    return renderOverviewPage()
  }

  function renderDrawer(route: RouteId) {
    if (!drawerOpen) return ''
    return `
      <div class="drawer-backdrop" data-drawer-backdrop>
        <aside class="drawer" aria-label="文档导航">
          <div class="drawer-head">
            <strong>TimCSS 文档导航</strong>
            <button class="ghost-link-button" data-close-drawer>关闭</button>
          </div>
          <div class="drawer-links">
            ${(Object.keys(routeLabels) as RouteId[])
              .map(
                (item) =>
                  `<button class="drawer-link ${route === item ? 'is-active' : ''}" data-route="${item}">${escapeHtml(routeLabels[item])}</button>`,
              )
              .join('')}
          </div>
        </aside>
      </div>
    `
  }

  function renderPalette(visible: DocItem[]) {
    let commands = getPaletteCommands(createSearchContext(query), visible)
    if (!paletteOpen) return ''
    return `
      <div class="palette-backdrop" data-palette-backdrop>
        <div class="palette" role="dialog" aria-modal="true" aria-label="命令搜索">
          <div class="palette-head">
            <input id="palette-input" type="search" placeholder="搜索页面、接入方式、快捷问题或原子类…" value="${escapeHtml(paletteQuery)}" />
            <button class="ghost-link-button" data-close-palette>关闭</button>
          </div>
          <div class="palette-list">
            ${
              commands.length > 0
                ? commands
                    .map(
                      (item, index) => `
                        <button class="palette-item ${index === 0 ? 'is-active' : ''}" data-command-id="${item.id}">
                          <strong>${escapeHtml(item.title)}</strong>
                          <span>${escapeHtml(item.subtitle)}</span>
                        </button>
                      `,
                    )
                    .join('')
                : `<div class="empty-card"><strong>没有匹配项。</strong><p>试试输入“搜索 安全区”或“前往 FAQ”。</p></div>`
            }
          </div>
        </div>
      </div>
    `
  }

  function render() {
    let focusSnapshot = captureInputFocusSnapshot()
    let search = createSearchContext(query)
    let visible = filterItems(search)
    if (!items.some((item) => item.id === selectedId)) {
      selectedId = items.find((item) => item.status === 'stable')?.id ?? items[0]?.id ?? ''
    }
    setHashState({
      route,
      query,
      platform: activePlatform,
      category: activeCategory,
      selected: selectedId,
    })
    document.title = route === 'overview' ? 'TimCSS 文档站' : `TimCSS 文档站 · ${routeLabels[route]}`

    app.innerHTML = `
      <div class="site-shell">
        <header class="topbar">
          <div class="topbar-brand">
            <button class="brand-mark brand-button" data-route="overview">TimCSS</button>
          </div>
          <button class="topbar-menu" data-open-drawer>导航</button>
          <nav class="topbar-nav">
            ${renderRouteNav(route)}
          </nav>
          <button class="topbar-search" data-open-palette>⌘K / Ctrl+K</button>
        </header>

        <main class="page">
          ${renderPage()}
          ${renderPager(route)}

          <section class="section-block footer-block">
            <div class="footer-card">
              <h2>继续阅读</h2>
              <div class="footer-links">
                <button class="footer-link-card" data-route="foundations"><strong>尺寸基础</strong><span>先看移动端留白、触控、导航和安全区的尺寸规则。</span></button>
                <button class="footer-link-card" data-route="guides"><strong>开始使用</strong><span>先看 H5、微信小程序和 Taro / uni-app 的接入路径。</span></button>
                <button class="footer-link-card" data-route="catalog"><strong>原子检索</strong><span>按问题、意图和类名搜索，并直接复制最小示例。</span></button>
                <button class="footer-link-card" data-route="recipes"><strong>常用组合</strong><span>先拿高频移动端组合，再按业务微调。</span></button>
                <button class="footer-link-card" data-route="faq"><strong>FAQ</strong><span>集中看支持边界、默认行为和排查建议。</span></button>
              </div>
            </div>
          </section>
        </main>
        ${renderDrawer(route)}
        ${renderPalette(visible)}
      </div>
    `

    let searchInput = app.querySelector<HTMLInputElement>('#search-input')
    searchInput?.addEventListener('input', (event) => {
      query = (event.target as HTMLInputElement).value
      render()
    })

    let paletteInput = app.querySelector<HTMLInputElement>('#palette-input')
    paletteInput?.addEventListener('input', (event) => {
      paletteQuery = (event.target as HTMLInputElement).value
      render()
    })
    if (focusSnapshot) {
      restoreInputFocusSnapshot(app, focusSnapshot)
    } else if (paletteOpen) {
      paletteInput?.focus()
    }

    paletteInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      let commandId = app.querySelector<HTMLButtonElement>('[data-command-id]')?.dataset.commandId
      if (!commandId) return
      let command = getPaletteCommands(createSearchContext(query), visible).find((item) => item.id === commandId)
      command?.action()
    })

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-route]')) {
      button.addEventListener('click', () => {
        let next = button.dataset.route as RouteId | undefined
        if (!next) return
        route = next
        drawerOpen = false
        render()
      })
    }

    app.querySelectorAll<HTMLElement>('[data-open-drawer]').forEach((button) => {
      button.addEventListener('click', () => {
        drawerOpen = true
        render()
      })
    })

    app.querySelectorAll<HTMLElement>('[data-close-drawer]').forEach((button) => {
      button.addEventListener('click', () => {
        drawerOpen = false
        render()
      })
    })

    app.querySelector<HTMLElement>('[data-drawer-backdrop]')?.addEventListener('click', (event) => {
      if (event.target !== event.currentTarget) return
      drawerOpen = false
      render()
    })

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-open-palette]')) {
      button.addEventListener('click', () => {
        paletteOpen = true
        paletteQuery = ''
        render()
      })
    }

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-close-palette]')) {
      button.addEventListener('click', () => {
        paletteOpen = false
        render()
      })
    }

    app.querySelector<HTMLElement>('[data-palette-backdrop]')?.addEventListener('click', (event) => {
      if (event.target !== event.currentTarget) return
      paletteOpen = false
      render()
    })

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-search-chip]')) {
      button.addEventListener('click', () => {
        openCatalogSearch(button.dataset.searchChip ?? '')
      })
    }

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-recipe-search]')) {
      button.addEventListener('click', () => {
        openCatalogSearch(button.dataset.recipeSearch ?? '')
      })
    }

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-browse-category]')) {
      button.addEventListener('click', () => {
        openCategoryBrowse(button.dataset.browseCategory ?? 'all')
      })
    }

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-browse-select]')) {
      button.addEventListener('click', () => {
        selectedId = button.dataset.browseSelect ?? selectedId
        route = 'catalog'
        render()
      })
    }

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-platform]')) {
      button.addEventListener('click', () => {
        let next = button.dataset.platform
        if (next === 'all' || next === 'mobile' || next === 'wechat-miniprogram') activePlatform = next
        render()
      })
    }

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-category]')) {
      button.addEventListener('click', () => {
        activeCategory = button.dataset.category ?? 'all'
        render()
      })
    }

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-guide-platform]')) {
      button.addEventListener('click', () => {
        let platform = button.dataset.guidePlatform
        if (platform === 'all' || platform === 'mobile' || platform === 'wechat-miniprogram') {
          openCatalogSearch(button.dataset.guideQuery ?? '', platform)
        }
      })
    }

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-select]')) {
      button.addEventListener('click', () => {
        selectedId = button.dataset.select ?? selectedId
        render()
      })
    }

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
      button.addEventListener('click', () => {
        copyText(button.dataset.copy ?? '')
      })
    }

    app.querySelector<HTMLButtonElement>('[data-copy-link]')?.addEventListener('click', () => {
      copyText(window.location.href)
    })

    app.querySelectorAll<HTMLButtonElement>('[data-reset-search]').forEach((button) => {
      button.addEventListener('click', () => {
        query = ''
        activePlatform = 'all'
        activeCategory = 'all'
        render()
      })
    })

    app.querySelector<HTMLButtonElement>('[data-copy-detail-link]')?.addEventListener('click', () => {
      copyText(app.querySelector<HTMLButtonElement>('[data-copy-detail-link]')?.dataset.copyDetailLink ?? '')
    })

    for (let button of app.querySelectorAll<HTMLButtonElement>('[data-command-id]')) {
      button.addEventListener('click', () => {
        let command = getPaletteCommands(createSearchContext(query), visible).find((item) => item.id === button.dataset.commandId)
        command?.action()
      })
    }
  }

  window.addEventListener('hashchange', () => {
    if (ignoreNextHashChange) {
      ignoreNextHashChange = false
      return
    }
    let state = getHashState()
    route = state.route
    query = state.query
    activePlatform = state.platform
    activeCategory = state.category
    selectedId = state.selected || selectedId
    render()
  })

  document.addEventListener('keydown', (event) => {
    let isTypingTarget =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    if (event.key === '/' && !isTypingTarget) {
      event.preventDefault()
      if (route !== 'catalog') {
        route = 'catalog'
        render()
      }
      window.setTimeout(() => {
        document.querySelector<HTMLInputElement>('#search-input')?.focus()
      }, 0)
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      paletteOpen = !paletteOpen
      if (!paletteOpen) paletteQuery = ''
      render()
      return
    }
    if (event.key === 'Escape' && paletteOpen) {
      paletteOpen = false
      render()
      return
    }
    if (event.key === 'Escape' && drawerOpen) {
      drawerOpen = false
      render()
    }
  })

  render()
}

loadIndex()
  .then(({ meta, items }) => renderApp(meta, items))
  .catch((error) => {
    let app = document.querySelector<HTMLDivElement>('#app')
    if (!app) return
    app.innerHTML = `<div class="site-shell"><main class="page"><div class="empty-card">TimCSS 文档索引加载失败：<code>${escapeHtml(String(error))}</code></div></main></div>`
  })
