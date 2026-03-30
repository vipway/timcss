import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

const files = {
  mobile: path.join(root, 'packages', 'timcss-preset-mobile', 'src', 'index.ts'),
  wechat: path.join(root, 'packages', 'timcss-preset-wechat', 'src', 'index.ts'),
  variants: path.join(root, 'packages', 'timcss-variants', 'src', 'index.ts'),
}

const docsDir = path.join(root, 'docs')
const jsonTarget = path.join(docsDir, 'atomic-utilities-index.json')
const mdTarget = path.join(docsDir, 'atomic-utilities-index.md')
const schemaVersion = '1.2.0'
const packageManifest = path.join(root, 'packages', 'timcss-core', 'package.json')

const utilityMetadata = {
  'px-page': { category: 'layout', intent: '页面左右基础边距', whenToUse: '页面主容器、列表页、表单页' },
  'py-section': { category: 'layout', intent: '模块上下节奏间距', whenToUse: '区块型页面、内容段落分组' },
  'p-card': { category: 'layout', intent: '卡片默认内边距', whenToUse: '白底卡片、信息卡、订单卡' },
  'gap-section': { category: 'layout', intent: '模块与模块之间的主间距', whenToUse: '垂直 stack 布局' },
  'gap-card': { category: 'layout', intent: '卡片内部子元素的常规间距', whenToUse: '卡片内部标题、说明、按钮组' },
  'h-nav': { category: 'layout', intent: '导航区域高度', whenToUse: '顶部导航、沉浸式头部容器' },
  'h-tabbar': { category: 'layout', intent: '底部 tabbar 区域高度', whenToUse: '底部导航、吸底操作容器' },
  'h-control-xs': { category: 'control', intent: '极小控件高度', whenToUse: '小标签、小尺寸输入元素' },
  'h-control-sm': { category: 'control', intent: '小控件高度', whenToUse: '紧凑按钮、紧凑表单' },
  'h-control': { category: 'control', intent: '默认控件高度', whenToUse: '默认按钮、输入框、选择器' },
  'h-control-lg': { category: 'control', intent: '大控件高度', whenToUse: '强调按钮、主操作区' },
  'h-control-xl': { category: 'control', intent: '超大控件高度', whenToUse: '吸底主按钮、大尺寸操作区' },
  'min-h-touch': { category: 'control', intent: '确保满足移动端触控热区', whenToUse: '任何可点击行、按钮、列表项' },
  'rounded-card': { category: 'shape', intent: '卡片圆角', whenToUse: '卡片、弹层、信息块' },
  'rounded-control': { category: 'shape', intent: '控件圆角', whenToUse: '按钮、输入框、胶囊控件' },
  'bg-primary': { category: 'color', intent: '主品牌背景色', whenToUse: '主按钮、主状态块' },
  'bg-surface': { category: 'color', intent: '表面层背景色', whenToUse: '卡片、弹层、白底容器' },
  'bg-background': { category: 'color', intent: '页面背景色', whenToUse: '页面根节点、列表页底色' },
  'text-primary': { category: 'color', intent: '主要文本颜色', whenToUse: '正文、标题、主信息' },
  'text-muted': { category: 'color', intent: '次级文本颜色', whenToUse: '辅助说明、时间、备注' },
  'text-on-primary': { category: 'color', intent: '主色背景上的文本色', whenToUse: '主按钮文本、主色块内文案' },
  'border-default': { category: 'color', intent: '默认边框色', whenToUse: '输入框、卡片边框、分隔线容器' },
  'shadow-card': { category: 'shadow', intent: '轻量卡片阴影', whenToUse: '默认卡片、轻浮层' },
  'shadow-elevated': { category: 'shadow', intent: '强调浮层阴影', whenToUse: '弹层、浮动操作面板' },
  'pt-safe': { category: 'wechat-safe-area', intent: '顶部安全区内边距', whenToUse: '沉浸式头部、刘海屏顶部避让' },
  'pr-safe': { category: 'wechat-safe-area', intent: '右侧安全区内边距', whenToUse: '横向布局容器' },
  'pb-safe': { category: 'wechat-safe-area', intent: '底部安全区内边距', whenToUse: '吸底按钮、底部输入区' },
  'pl-safe': { category: 'wechat-safe-area', intent: '左侧安全区内边距', whenToUse: '横向布局容器' },
  'px-safe': { category: 'wechat-safe-area', intent: '左右安全区内边距', whenToUse: '全宽容器' },
  'py-safe': { category: 'wechat-safe-area', intent: '上下安全区内边距', whenToUse: '整屏安全区容器' },
  'pb-tabbar-safe': { category: 'wechat-safe-area', intent: '为底部 tabbar 和安全区同时预留空间', whenToUse: '吸底操作区、底部内容滚动容器' },
  'pt-nav-safe': { category: 'wechat-safe-area', intent: '为顶部导航和安全区同时预留空间', whenToUse: '沉浸式页面头部' },
  hairline: { category: 'wechat-hairline', intent: '全边发丝线', whenToUse: '卡片外框、浅边框块' },
  'hairline-t': { category: 'wechat-hairline', intent: '上边发丝线', whenToUse: '顶部边界线' },
  'hairline-r': { category: 'wechat-hairline', intent: '右边发丝线', whenToUse: '右侧边界线' },
  'hairline-b': { category: 'wechat-hairline', intent: '下边发丝线', whenToUse: '列表项底部分隔' },
  'hairline-l': { category: 'wechat-hairline', intent: '左边发丝线', whenToUse: '左侧边界线' },
}

const variantMetadata = {
  'pressed:': { category: 'variant', intent: '按压状态', whenToUse: '按钮、列表项、可点击块', status: 'stable' },
  'disabled:': { category: 'variant', intent: '禁用状态', whenToUse: '表单控件、按钮', status: 'stable' },
  'safe:': { category: 'variant', intent: '处于安全区上下文时生效', whenToUse: '组件级安全区布局', status: 'stable' },
  'notch:': { category: 'variant', intent: '刘海屏上下文时生效', whenToUse: '沉浸式头部与吸底区域', status: 'stable' },
  'tabbar-present:': { category: 'variant', intent: '页面存在 tabbar 时生效', whenToUse: '底部区域避让', status: 'stable' },
  'keyboard-open:': { category: 'variant', intent: '软键盘打开时生效', whenToUse: '输入区、底部表单布局', status: 'experimental' },
}

const categoryHeadings = {
  layout: '布局与间距',
  control: '控件与触控',
  shape: '形状',
  color: '语义颜色与阴影',
  shadow: '语义颜色与阴影',
  'wechat-safe-area': '微信小程序安全区与发丝线',
  'wechat-hairline': '微信小程序安全区与发丝线',
  variant: '状态变体',
}

function normalizeBody(body) {
  return body.replace(/\s+/g, ' ').replace(/ ;/g, ';').trim()
}

function slugify(value) {
  return value.replace(/[^a-zA-Z0-9:-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

function derivePlatforms(category) {
  if (category.startsWith('wechat-')) return ['wechat-miniprogram']
  if (category === 'variant') return ['mobile', 'wechat-miniprogram']
  return ['mobile', 'wechat-miniprogram']
}

function deriveStatus(category, metadata = {}) {
  if (metadata.status) return metadata.status
  if (category.startsWith('wechat-')) return 'stable'
  if (category === 'variant') return 'stable'
  return 'stable'
}

function deriveSourcePackage(category) {
  if (category.startsWith('wechat-')) return '@timcss/preset-wechat'
  if (category === 'variant') return '@timcss/variants'
  return '@timcss/preset-mobile'
}

function buildEntry({ className, category, intent, output, whenToUse, kind, packageVersion }) {
  const metaSource = kind === 'variant' ? variantMetadata[className] : utilityMetadata[className]
  const status = deriveStatus(category, metaSource)
  return {
    id: `timcss.${kind}.${slugify(className)}`,
    className,
    kind,
    category,
    intent,
    output,
    whenToUse,
    platforms: derivePlatforms(category),
    sourcePackage: deriveSourcePackage(category),
    status,
    since: packageVersion,
    schemaVersion,
  }
}

function parseUtilities(source, packageVersion) {
  const regex = /className:\s*'([^']+)'\s*,\s*body:\s*'([^']+)'/g
  const items = []
  let match
  while ((match = regex.exec(source))) {
    const className = match[1]
    const output = normalizeBody(match[2])
    const metadata = utilityMetadata[className]
    items.push(
      buildEntry({
        className,
        kind: 'utility',
        category: metadata?.category ?? 'uncategorized',
        intent: metadata?.intent ?? `${className} 原子样式`,
        output,
        whenToUse: metadata?.whenToUse ?? '按单一职责和移动端语义组合使用',
        packageVersion,
      }),
    )
  }
  return items
}

function parseVariants(source, packageVersion) {
  const objectBlock = source.match(/const DEFAULT_SELECTORS:[\s\S]*?= \{([\s\S]*?)\n\}/)
  if (!objectBlock) return []
  const items = []
  const entryRegex = /(?:'([^']+)'|(\w+)):\s*'([^']+)'/g
  let match
  while ((match = entryRegex.exec(objectBlock[1]))) {
    const rawName = match[1] || match[2]
    const className = `${rawName}:`
    const metadata = variantMetadata[className]
    items.push(
      buildEntry({
        className,
        kind: 'variant',
        category: metadata?.category ?? 'variant',
        intent: metadata?.intent ?? `${rawName} 状态变体`,
        output: match[3],
        whenToUse: metadata?.whenToUse ?? '给原子类增加状态上下文',
        packageVersion,
      }),
    )
  }
  return items
}

function sortItems(items) {
  const categoryOrder = ['layout', 'control', 'shape', 'color', 'shadow', 'wechat-safe-area', 'wechat-hairline', 'variant']
  return items.slice().sort((a, b) => {
    const ac = categoryOrder.indexOf(a.category)
    const bc = categoryOrder.indexOf(b.category)
    if (ac !== bc) return ac - bc
    return a.className.localeCompare(b.className)
  })
}

function toMarkdown(items, packageVersion) {
  const lines = []
  lines.push('# TimCSS 原子样式索引')
  lines.push('')
  lines.push('> 本文件由 `scripts/generate-timcss-doc-index.mjs` 自动生成，请不要手工编辑。')
  lines.push('')
  lines.push(`- 索引 schema 版本：\`${schemaVersion}\``)
  lines.push(`- TimCSS 版本：\`${packageVersion}\``)
  lines.push('')
  lines.push('本文档按“类名 → 意图 → 输出 → 使用建议 → 元数据”的方式组织，便于全文检索。')
  lines.push('')
  lines.push('搜索建议：')
  lines.push('')
  lines.push('- 直接搜 class 名，如 `pb-safe`')
  lines.push('- 搜意图关键词，如“卡片内边距”“触控热区”“底部安全区”')
  lines.push('- 搜 CSS 属性，如 `padding-inline`、`box-shadow`')
  lines.push('- 搜稳定性，如 `stable`、`experimental`')
  lines.push('')
  lines.push('---')
  lines.push('')

  let currentCategory = null
  for (const item of items) {
    if (item.category !== currentCategory) {
      currentCategory = item.category
      lines.push(`## ${categoryHeadings[item.category] ?? item.category}`)
      lines.push('')
    }
    const outputLabel = item.kind === 'variant' ? '选择器' : '输出'
    lines.push(`### \`${item.className}\``)
    lines.push(`- ID：\`${item.id}\``)
    lines.push(`- 意图：${item.intent}。`)
    lines.push(`- ${outputLabel}：\`${item.output}\``)
    lines.push(`- 适合：${item.whenToUse}。`)
    lines.push(`- 平台：${item.platforms.join(' / ')}`)
    lines.push(`- 稳定性：\`${item.status}\``)
    lines.push(`- 来源包：\`${item.sourcePackage}\``)
    lines.push(`- since：\`${item.since}\``)
    lines.push('')
  }
  return lines.join('\n')
}

const mobileSource = await fs.readFile(files.mobile, 'utf8')
const wechatSource = await fs.readFile(files.wechat, 'utf8')
const variantsSource = await fs.readFile(files.variants, 'utf8')
const packageJson = JSON.parse(await fs.readFile(packageManifest, 'utf8'))
const packageVersion = packageJson.version

if (typeof packageVersion !== 'string' || packageVersion.length === 0) {
  throw new Error(`Invalid package version in ${path.relative(root, packageManifest)}`)
}

const items = sortItems([
  ...parseUtilities(mobileSource, packageVersion),
  ...parseUtilities(wechatSource, packageVersion),
  ...parseVariants(variantsSource, packageVersion),
])

const payload = {
  schemaVersion,
  generatedAt: new Date().toISOString(),
  packageVersion,
  items,
}

await fs.mkdir(docsDir, { recursive: true })
await fs.writeFile(jsonTarget, `${JSON.stringify(payload, null, 2)}\n`)
await fs.writeFile(mdTarget, `${toMarkdown(items, packageVersion)}\n`)

console.log(`[timcss-docs] generated ${path.relative(root, jsonTarget)} and ${path.relative(root, mdTarget)} from source presets/variants`)
