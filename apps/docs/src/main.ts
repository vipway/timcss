import './style.css'
import {
  expandTimcssIntentTerms,
  includesTimcssTerm,
  isTimcssIntentQuery,
  normalizeTimcssIntentQuery,
  splitTimcssSearchTerms,
} from '../../../packages/timcss-core/src/search'
import docIndex from '../../../docs/atomic-utilities-index.json'

type StatusTag = 'stable' | 'experimental'
type PlatformTag = 'mobile' | 'wechat-miniprogram'
type KindTag = 'utility' | 'variant'
type RouteId = 'overview' | 'guides' | 'browse' | 'recipes' | 'catalog' | 'faq'

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

const staleIndexThresholdMs = 7 * 24 * 60 * 60 * 1000

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
  guides: '开始使用',
  browse: '分类浏览',
  recipes: '常用组合',
  catalog: '原子检索',
  faq: 'FAQ',
}
const routeOrder: RouteId[] = ['overview', 'guides', 'browse', 'recipes', 'catalog', 'faq']

const quickSearches = ['底部安全区 吸底', '按钮高度 触控', '卡片圆角 阴影', '发丝线 分隔', 'pressed:']

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

async function loadIndex(): Promise<{ meta: DocIndexPayload; items: DocItem[] }> {
  let payload = docIndex as DocIndexPayload
  return {
    meta: payload,
    items: payload.items.map(toDocItem),
  }
}

function isRouteId(value: string): value is RouteId {
  return value === 'overview' || value === 'guides' || value === 'browse' || value === 'recipes' || value === 'catalog' || value === 'faq'
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
  if (window.location.hash !== target) window.location.hash = target
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
          <h1>把移动端原子样式讲清楚，而不是把用户淹没在信息里。</h1>
          <p class="hero-text">
            TimCSS 专注移动端 H5 与原生微信小程序。文档站优先回答 3 件事：支持边界、接入方式、原子类怎么搜。
          </p>
          <div class="hero-actions">
            <button class="primary-link button-link" data-route="catalog">开始搜索原子</button>
            <button class="ghost-link button-link" data-route="guides">查看接入方式</button>
          </div>
        </div>
        <div class="hero-side">
          <div class="summary-card">
            <div class="summary-title">当前官方口径</div>
            <ul class="summary-list">
              <li>已验证：移动端 H5、原生微信小程序</li>
              <li>优先能力：安全区、发丝线、移动端控件、状态变体</li>
              <li>Taro / uni-app：可接入，需项目验证</li>
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
          <p class="eyebrow">Principles</p>
          <h2>文档站只回答 4 个问题。</h2>
          <p>参考 Tailwind 的文档分层方式，但更聚焦移动端与小程序的原子语义。</p>
        </div>
        <div class="principle-grid">
          <article class="principle-card"><h3>它解决什么问题？</h3><p>比如安全区、发丝线、按钮高度、卡片层级，而不是只有 class 名字。</p></article>
          <article class="principle-card"><h3>什么时候用？</h3><p>每个原子都给出使用场景、组合建议和最小示例，避免用户自己猜。</p></article>
          <article class="principle-card"><h3>在哪个平台可用？</h3><p>H5 与微信小程序边界直接写清楚，不把“可接入”说成“已验证”。</p></article>
          <article class="principle-card"><h3>怎么快速找到？</h3><p>支持按类名、按问题、按意图搜索，并给出常见场景组合。</p></article>
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <p class="eyebrow">Quick Start</p>
          <h2>常用入口</h2>
        </div>
        <div class="overview-actions">
          ${quickSearches
            .map(
              (item) =>
                `<button class="shortcut-chip" data-search-chip="${escapeHtml(item)}">搜索 ${escapeHtml(item)}</button>`,
            )
            .join('')}
          <button class="shortcut-chip" data-route="guides">查看接入路径</button>
          <button class="shortcut-chip" data-route="faq">查看 FAQ</button>
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

  function renderGuidesPage() {
    return `
      <section class="section-block route-hero">
        <div class="section-head">
          <p class="eyebrow">Get Started</p>
          <h2>先选接入路径，再开始搜原子。</h2>
          <p>把“安装 / 配置 / 使用边界”拆开讲，默认只展示真正会用到的信息。</p>
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
        <div class="section-head">
          <p class="eyebrow">Browse</p>
          <h2>按分类浏览原子能力。</h2>
          <p>适合你还不知道具体类名，但知道自己要找的是布局、控件、安全区、发丝线还是状态能力。</p>
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
        <div class="section-head">
          <p class="eyebrow">Recipes</p>
          <h2>先拿到组合，再按需微调。</h2>
          <p>这些 recipes 不是组件库，而是高频移动端场景的原子组合模板，适合直接复制后再按业务调整。</p>
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
        <div class="section-head">
          <p class="eyebrow">Search</p>
          <h2>从问题开始找原子类。</h2>
          <p>可以直接搜类名，也可以搜“底部安全区”“按钮高度”“卡片圆角”。输入 <code>intent:底部安全区</code> 时会更偏向语义匹配。</p>
        </div>

        <div class="search-panel">
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
                ? visible.slice(0, 24).map((item) => renderResultCard(item, search, selected?.id === item.id)).join('')
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
                    <div class="mini-heading">它解决什么问题</div>
                    <p>${highlight(selected.intent, search.highlightQuery)}</p>
                  </div>
                  <div class="detail-block">
                    <div class="mini-heading">什么时候用</div>
                    <p>${highlight(selected.whenToUse, search.highlightQuery)}</p>
                  </div>
                  <div class="detail-block">
                    <div class="mini-heading">怎么组合</div>
                    <p>${escapeHtml(getCompositionSuggestion(selected))}</p>
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
        <div class="section-head">
          <p class="eyebrow">FAQ</p>
          <h2>常见问题一次说明白。</h2>
          <p>把支持边界、平台定位、产物输出和排查建议放到一处，减少重复解释。</p>
        </div>
        <div class="faq-list">
          ${renderFaqList()}
        </div>
      </section>
    `
  }

  function renderPage() {
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
            <span class="brand-note">移动端与微信小程序原子样式文档</span>
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
                <span><code>docs/start-here.md</code>：先看产品定位</span>
                <span><code>docs/integration-h5.md</code>：H5 接入</span>
                <span><code>docs/integration-wechat-miniapp.md</code>：微信小程序接入</span>
                <span><code>docs/faq.md</code>：FAQ 文档</span>
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
    paletteInput?.focus()

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
