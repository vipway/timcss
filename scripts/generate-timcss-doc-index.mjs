import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
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
const docsPublicTarget = path.join(root, 'apps', 'docs', 'public', 'atomic-utilities-index.json')
const schemaVersion = '1.5.0'
const packageManifest = path.join(root, 'packages', 'timcss-core', 'package.json')
const enginePackageManifest = path.join(root, 'packages', 'timcss-engine', 'package.json')
const engineRequire = createRequire(enginePackageManifest)
const tailwindPackage = unwrapModule(engineRequire('tailwindcss/package.json'))
const tailwindModule = unwrapModule(engineRequire('tailwindcss'))
const tailwindCssEntry = `@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css" layer(utilities);`

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
  'core-spacing': 'Tailwind 官方间距原子',
  'core-sizing': 'Tailwind 官方尺寸原子',
  'core-layout': 'Tailwind 官方布局原子',
  'core-typography': 'Tailwind 官方排版原子',
  'core-color': 'Tailwind 官方颜色原子',
  'core-shape': 'Tailwind 官方边框与圆角原子',
  'core-effect': 'Tailwind 官方效果原子',
}

const categoryOrder = [
  'layout',
  'control',
  'shape',
  'color',
  'shadow',
  'wechat-safe-area',
  'wechat-hairline',
  'variant',
  'core-spacing',
  'core-sizing',
  'core-layout',
  'core-typography',
  'core-color',
  'core-shape',
  'core-effect',
]

const officialCategoryDescriptions = {
  'core-spacing': {
    intent: '调节局部间距与节奏',
    whenToUse: '页面骨架已经确定后，用来微调组件留白、列表节奏和局部布局。页面主留白优先使用 TimCSS 的语义尺寸原子。',
  },
  'core-sizing': {
    intent: '控制结构尺寸与比例',
    whenToUse: '用于容器、图片、面板和自定义组件的宽高控制。交互控件高度优先对照 TimCSS 的 h-control 和 min-h-touch。',
  },
  'core-layout': {
    intent: '设置布局方式、位置与流向',
    whenToUse: '用于 display、position、flex、grid、overflow 和层级位置。先定结构，再叠加尺寸与视觉。',
  },
  'core-typography': {
    intent: '调整文字排版与阅读节奏',
    whenToUse: '用于字号、行高、字重、对齐、换行和装饰线。移动端建议保持少量稳定层级。',
  },
  'core-color': {
    intent: '设置局部颜色、描边与渐变',
    whenToUse: '适合局部业务例外和快速试色。高频复用的业务语义颜色更适合沉淀成 TimCSS 语义原子。',
  },
  'core-shape': {
    intent: '设置边框、圆角与轮廓',
    whenToUse: '用于卡片、输入框、图片容器和浅边界。尽量减少同屏轮廓风格数量。',
  },
  'core-effect': {
    intent: '设置层级、状态与视觉效果',
    whenToUse: '用于阴影、透明度、变换、滤镜和过渡。效果要服务层级理解，而不是喧宾夺主。',
  },
}

function unwrapModule(value) {
  return value && typeof value === 'object' && 'default' in value ? value.default : value
}

function normalizeOutput(value) {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(value) {
  return value.replace(/[^a-zA-Z0-9:-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
}

function derivePlatforms(category) {
  if (category.startsWith('wechat-')) return ['wechat-miniprogram']
  return ['mobile', 'wechat-miniprogram']
}

function deriveStatus(category, metadata = {}) {
  if (metadata.status) return metadata.status
  return 'stable'
}

function deriveSourcePackage(category) {
  if (category.startsWith('wechat-')) return '@timcss/preset-wechat'
  if (category === 'variant') return '@timcss/variants'
  if (category.startsWith('core-')) return 'tailwindcss'
  return '@timcss/preset-mobile'
}

function buildEntry({
  className,
  category,
  intent,
  output,
  whenToUse,
  kind,
  packageVersion,
  sourcePackage,
  platforms,
  status,
  since,
  modifiers,
}) {
  const metaSource = kind === 'variant' ? variantMetadata[className] : utilityMetadata[className]
  return {
    id: `timcss.${kind}.${slugify(className)}`,
    className,
    kind,
    category,
    intent,
    output: normalizeOutput(output),
    whenToUse,
    platforms: platforms ?? derivePlatforms(category),
    sourcePackage: sourcePackage ?? deriveSourcePackage(category),
    status: status ?? deriveStatus(category, metaSource),
    since: since ?? packageVersion,
    schemaVersion,
    ...(Array.isArray(modifiers) && modifiers.length > 0 ? { modifiers } : {}),
  }
}

function parseUtilities(source, packageVersion) {
  const regex = /className:\s*'([^']+)'\s*,\s*body:\s*'([^']+)'/g
  const items = []
  let match
  while ((match = regex.exec(source))) {
    const className = match[1]
    const metadata = utilityMetadata[className]
    items.push(
      buildEntry({
        className,
        kind: 'utility',
        category: metadata?.category ?? 'uncategorized',
        intent: metadata?.intent ?? `${className} 原子样式`,
        output: match[2],
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

async function loadTailwindDesignSystem() {
  async function loadStylesheet(id, base) {
    const resolved = path.isAbsolute(id) || id.startsWith('.') ? path.resolve(base, id) : engineRequire.resolve(id)
    return {
      path: resolved,
      base: path.dirname(resolved),
      content: await fs.readFile(resolved, 'utf8'),
    }
  }

  return tailwindModule.__unstable__loadDesignSystem(tailwindCssEntry, {
    base: root,
    loadStylesheet,
  })
}

function extractRuleBody(css) {
  const trimmed = css.trim()
  const openIndex = trimmed.indexOf('{')
  if (trimmed.startsWith('.') && openIndex !== -1) {
    let depth = 0
    for (let index = openIndex; index < trimmed.length; index += 1) {
      const char = trimmed[index]
      if (char === '{') depth += 1
      if (char === '}') {
        depth -= 1
        if (depth === 0) return trimmed.slice(openIndex + 1, index).trim()
      }
    }
  }
  return trimmed
}

function looksLikeColorValue(value) {
  return (
    value === 'current' ||
    value === 'inherit' ||
    value === 'transparent' ||
    value === 'black' ||
    value === 'white' ||
    /^[a-z]+-\d{2,3}$/.test(value)
  )
}

function containsAny(value, needles) {
  return needles.some((needle) => value.includes(needle))
}

function readPropertyValue(output, properties) {
  for (let property of properties) {
    let match = output.match(new RegExp(`${property}:\\s*([^;]+);`))
    if (match?.[1]) return match[1].trim()
  }
  return null
}

function getParsedValue(parsed) {
  if (!parsed || !('value' in parsed) || !parsed.value) return null
  if (typeof parsed.value === 'string') return parsed.value
  if (parsed.value.kind === 'arbitrary') return parsed.value.value ?? null
  if (parsed.value.kind === 'named') return parsed.value.fraction ? parsed.value.fraction : parsed.value.value ?? null
  return null
}

function formatTailwindScaleValue(parsedValue, unit = '') {
  if (!parsedValue) return null
  if (/^-?\d+(\.\d+)?$/.test(parsedValue)) return `${parsedValue}${unit}`
  return parsedValue
}

function classifyOfficialUtility(className, output, parsed) {
  const root = parsed?.root ?? ''
  const value = parsed?.value?.value ?? ''

  if (className === 'sr-only' || className === 'not-sr-only') return 'core-layout'

  if (
    /^(p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|space-x|space-y|gap|gap-x|gap-y|scroll-p|scroll-m)/.test(
      root,
    )
  ) {
    return 'core-spacing'
  }

  if (/^(w|min-w|max-w|h|min-h|max-h|size|basis|aspect|columns)/.test(root)) {
    return 'core-sizing'
  }

  if (/^(rounded|border|divide|outline)/.test(root)) {
    if (looksLikeColorValue(value) || containsAny(output, ['border-color:', 'outline-color:'])) return 'core-color'
    return 'core-shape'
  }

  if (/^(ring|ring-offset)$/.test(root)) {
    if (looksLikeColorValue(value) || containsAny(output, ['--tw-ring-color:', '--tw-ring-offset-color:'])) return 'core-color'
    return 'core-shape'
  }

  if (/^(shadow|drop-shadow|opacity|blur|backdrop|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia|mix-blend|bg-blend|scale|rotate|skew|translate|origin|duration|delay|ease|animate|will-change|transform|filter|cursor)/.test(root)) {
    return 'core-effect'
  }

  if (
    /^(flex|grid|col|row|block|inline|table|hidden|float|clear|isolate|box|object|overflow|overscroll|z|order|top|right|bottom|left|inset|relative|absolute|fixed|sticky|items|justify|content|self|place|grow|shrink|container|list-item|contents|appearance|resize|visible|invisible|collapse|pointer-events|snap)/.test(
      root,
    )
  ) {
    return 'core-layout'
  }

  if (/^(font|leading|tracking|underline-offset|decoration|indent|whitespace|break|hyphens|align|truncate|line-clamp|italic|not-italic|uppercase|lowercase|capitalize|normal-case|antialiased|subpixel-antialiased|placeholder|list)/.test(root)) {
    return 'core-typography'
  }

  if (root === 'text') {
    if (
      /^(xs|sm|base|lg|xl|\d+xl|left|center|right|justify|start|end|ellipsis|clip|wrap|nowrap|balance|pretty)$/.test(
        value,
      ) ||
      containsAny(output, ['font-size:', 'text-align:', 'text-wrap:', 'text-indent:', 'text-decoration-'])
    ) {
      return 'core-typography'
    }
    return 'core-color'
  }

  if (
    containsAny(output, [
      'padding',
      'margin',
      'column-gap',
      'row-gap',
      'gap:',
      '--tw-space-',
      'scroll-padding',
      'scroll-margin',
    ])
  ) {
    return 'core-spacing'
  }

  if (
    containsAny(output, [
      'font-size:',
      'line-height:',
      'font-weight:',
      'letter-spacing:',
      'text-align:',
      'text-wrap:',
      'text-indent:',
      'text-overflow:',
      'text-transform:',
      'font-style:',
      'font-family:',
      'list-style',
      'text-decoration-',
      'white-space:',
      'overflow-wrap:',
      'word-break:',
      '-webkit-line-clamp',
      'hyphens:',
      'vertical-align:',
    ])
  ) {
    return 'core-typography'
  }

  if (
    containsAny(output, [
      'background-color:',
      'background-image:',
      'border-color:',
      'accent-color:',
      'caret-color:',
      'fill:',
      'stroke:',
      'outline-color:',
      '--tw-ring-color:',
      '--tw-ring-offset-color:',
      '--tw-gradient-from',
      '--tw-gradient-via',
      '--tw-gradient-to',
      'stop-color:',
    ]) ||
    (output.startsWith('color:') && root !== 'text' && root !== 'placeholder')
  ) {
    return 'core-color'
  }

  if (
    root === 'text' &&
    value &&
    !/^(xs|sm|base|lg|xl|\d+xl|left|center|right|justify|start|end|ellipsis|clip|wrap|nowrap|balance|pretty)$/.test(
      value,
    ) &&
    !containsAny(output, ['font-size:', 'text-align:', 'text-wrap:'])
  ) {
    return 'core-color'
  }

  if (
    containsAny(output, [
      'border-radius',
      'border-width',
      'outline-width',
      'outline-offset',
      'box-decoration-break',
      '--tw-divide-',
    ])
  ) {
    return 'core-shape'
  }

  if (
    containsAny(output, [
      'width:',
      'height:',
      'min-width:',
      'min-height:',
      'max-width:',
      'max-height:',
      'aspect-ratio:',
      'column-count:',
      'flex-basis:',
    ])
  ) {
    return 'core-sizing'
  }

  if (
    containsAny(output, [
      'box-shadow:',
      'opacity:',
      'filter:',
      'backdrop-filter:',
      'mix-blend-mode:',
      'background-blend-mode:',
      'transform:',
      '--tw-translate',
      '--tw-rotate',
      '--tw-scale',
      '--tw-skew',
      'transform-origin:',
      'transition-',
      'animation:',
      'will-change:',
      'cursor:',
    ])
  ) {
    return 'core-effect'
  }

  if (
    containsAny(output, [
      'display:',
      'position:',
      'inset:',
      'inset-inline',
      'inset-block',
      'top:',
      'right:',
      'bottom:',
      'left:',
      'overflow:',
      'overflow-x:',
      'overflow-y:',
      'justify-',
      'align-',
      'place-',
      'grid-',
      'flex:',
      'flex-direction:',
      'flex-wrap:',
      'flex-grow:',
      'flex-shrink:',
      'z-index:',
      'order:',
      'object-',
      'float:',
      'clear:',
      'isolation:',
      'box-sizing:',
      'resize:',
      'visibility:',
      'pointer-events:',
      'scroll-snap',
      'overscroll',
    ])
  ) {
    return 'core-layout'
  }

  return 'core-layout'
}

function getPrimaryValue(output) {
  return output.match(/:\s*([^;]+);/)?.[1]?.trim() ?? null
}

function describeOfficialIntent(className, category, output, parsed) {
  const parsedValue = getParsedValue(parsed)
  const value = getPrimaryValue(output)
  const root = parsed?.root ?? className

  if (category === 'core-spacing') {
    let spacingValue =
      readPropertyValue(output, [
        'padding',
        'padding-inline',
        'padding-block',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        'margin',
        'margin-inline',
        'margin-block',
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
        'column-gap',
        'row-gap',
        'gap',
        'scroll-padding',
        'scroll-margin',
        'margin-block-start',
        'margin-block-end',
      ]) ?? parsedValue
    if (/^p[trblxyse]?/.test(root) && !root.startsWith('placeholder')) return `调节内边距${spacingValue ? `为 ${spacingValue}` : ''}`
    if (/^-?m[trblxyse]?/.test(root)) return `调节外边距${spacingValue ? `为 ${spacingValue}` : ''}`
    if (className.startsWith('gap')) return `调节容器间距${spacingValue ? `为 ${spacingValue}` : ''}`
    if (root === 'space-x') return `调节相邻元素横向间距${parsedValue ? `为 calc(var(--spacing) * ${parsedValue})` : spacingValue ? `为 ${spacingValue}` : ''}`
    if (root === 'space-y') return `调节相邻元素纵向间距${parsedValue ? `为 calc(var(--spacing) * ${parsedValue})` : spacingValue ? `为 ${spacingValue}` : ''}`
    if (className.startsWith('space-')) return `调节相邻元素节奏${spacingValue ? `为 ${spacingValue}` : ''}`
    if (root.startsWith('scroll-p')) return `调节滚动定位内边距${spacingValue ? `为 ${spacingValue}` : ''}`
    if (root.startsWith('scroll-m')) return `调节滚动定位外边距${spacingValue ? `为 ${spacingValue}` : ''}`
    return `${officialCategoryDescriptions[category].intent}${value ? `，当前值 ${value}` : ''}`
  }

  if (category === 'core-sizing') {
    let sizingValue =
      readPropertyValue(output, [
        'width',
        'height',
        'min-width',
        'min-height',
        'max-width',
        'max-height',
        'aspect-ratio',
        'flex-basis',
        'column-count',
      ]) ?? parsedValue
    if (root.startsWith('w')) return `调节宽度${sizingValue ? `为 ${sizingValue}` : ''}`
    if (root.startsWith('h')) return `调节高度${sizingValue ? `为 ${sizingValue}` : ''}`
    if (root.startsWith('min-')) return `设置最小尺寸${sizingValue ? `为 ${sizingValue}` : ''}`
    if (root.startsWith('max-')) return `设置最大尺寸${sizingValue ? `为 ${sizingValue}` : ''}`
    if (root === 'aspect') return `设置宽高比例${sizingValue ? `为 ${sizingValue}` : ''}`
    return `${officialCategoryDescriptions[category].intent}${value ? `，当前值 ${value}` : ''}`
  }

  if (category === 'core-typography') {
    if (root === 'text' && containsAny(output, ['font-size:', 'line-height:'])) return `调整字号与行高${value ? `，当前主值 ${value}` : ''}`
    if (root === 'text') return `调整文字颜色或排版语义${value ? `，当前主值 ${value}` : ''}`
    if (root === 'font') return `调整字体家族或字重${value ? `为 ${value}` : ''}`
    if (root === 'leading') return `调整行高${value ? `为 ${value}` : ''}`
    if (root === 'tracking') return `调整字间距${value ? `为 ${value}` : ''}`
    return `${officialCategoryDescriptions[category].intent}${value ? `，当前主值 ${value}` : ''}`
  }

  if (category === 'core-color') {
    let colorValue =
      readPropertyValue(output, [
        'background-color',
        'color',
        'border-color',
        'outline-color',
        '--tw-ring-color',
        '--tw-ring-offset-color',
        '--tw-gradient-from',
        '--tw-gradient-via',
        '--tw-gradient-to',
      ]) ?? parsedValue
    if (root.startsWith('bg') || root === 'from' || root === 'via' || root === 'to') return `设置背景色或渐变颜色${colorValue ? `，当前主值 ${colorValue}` : ''}`
    if (root === 'text') return `设置文本颜色${colorValue ? `为 ${colorValue}` : ''}`
    if (root.startsWith('border') || root.startsWith('divide')) return `设置边框颜色${colorValue ? `为 ${colorValue}` : ''}`
    if (root.startsWith('ring')) return `设置 ring 颜色${colorValue ? `为 ${colorValue}` : ''}`
    if (root.startsWith('outline')) return `设置 outline 颜色${colorValue ? `为 ${colorValue}` : ''}`
    return `${officialCategoryDescriptions[category].intent}${value ? `，当前主值 ${value}` : ''}`
  }

  if (category === 'core-shape') {
    let shapeValue =
      readPropertyValue(output, [
        'border-radius',
        'border-width',
        'outline-width',
        'outline-offset',
        '--tw-ring-offset-width',
      ]) ?? parsedValue
    if (root.startsWith('rounded')) return `设置圆角${shapeValue ? `为 ${shapeValue}` : ''}`
    if (root.startsWith('border')) return `设置边框宽度${shapeValue ? `为 ${shapeValue}` : ''}`
    if (root === 'ring') return `设置 ring 宽度${formatTailwindScaleValue(parsedValue, 'px') ? `为 ${formatTailwindScaleValue(parsedValue, 'px')}` : shapeValue ? `为 ${shapeValue}` : ''}`
    if (root === 'ring-offset') return `设置 ring 偏移宽度${formatTailwindScaleValue(parsedValue, 'px') ? `为 ${formatTailwindScaleValue(parsedValue, 'px')}` : shapeValue ? `为 ${shapeValue}` : ''}`
    if (root.startsWith('ring')) return `设置 ring 宽度或偏移${shapeValue ? `为 ${shapeValue}` : ''}`
    if (root.startsWith('outline')) return `设置 outline 轮廓${shapeValue ? `为 ${shapeValue}` : ''}`
    return `${officialCategoryDescriptions[category].intent}${value ? `，当前主值 ${value}` : ''}`
  }

  if (category === 'core-effect') {
    if (root.startsWith('shadow') || root === 'drop-shadow') return `设置阴影层级${value ? `，当前主值 ${value}` : ''}`
    if (root === 'opacity') return `设置透明度${value ? `为 ${value}` : ''}`
    if (containsAny(root, ['translate', 'rotate', 'scale', 'skew'])) return `设置变换效果${value ? `，当前主值 ${value}` : ''}`
    if (containsAny(root, ['duration', 'delay', 'ease', 'animate'])) return '设置过渡或动画节奏'
    return `${officialCategoryDescriptions[category].intent}${value ? `，当前主值 ${value}` : ''}`
  }

  if (category === 'core-layout') {
    if (className === 'sr-only') return '仅对屏幕阅读器可见'
    if (className === 'not-sr-only') return '恢复普通可见布局'
    if (containsAny(root, ['flex', 'items', 'justify', 'content', 'self', 'place'])) return '设置弹性布局与对齐方式'
    if (containsAny(root, ['grid', 'col', 'row'])) return '设置网格结构与栅格位置'
    if (containsAny(root, ['top', 'right', 'bottom', 'left', 'inset'])) return '设置定位偏移'
    if (containsAny(root, ['overflow', 'object'])) return '设置裁剪、滚动或对象适配'
    if (containsAny(root, ['absolute', 'relative', 'fixed', 'sticky'])) return '设置定位方式'
    return officialCategoryDescriptions[category].intent
  }

  return officialCategoryDescriptions[category]?.intent ?? `${className} 官方原子样式`
}

function describeOfficialWhenToUse(category, modifiers = []) {
  let base = officialCategoryDescriptions[category]?.whenToUse ?? '适合在 TimCSS 语义原子之外做局部精调。'
  if (modifiers.length > 0) {
    return `${base} 该原子还支持 /modifier 形式。`
  }
  return base
}

function uniqueItems(items) {
  const map = new Map()
  for (const item of items) map.set(`${item.kind}:${item.className}`, item)
  return [...map.values()]
}

function sortItems(items) {
  return items.slice().sort((left, right) => {
    const leftIndex = categoryOrder.indexOf(left.category)
    const rightIndex = categoryOrder.indexOf(right.category)
    if (leftIndex !== rightIndex) return leftIndex - rightIndex
    return left.className.localeCompare(right.className)
  })
}

async function writeFileAtomically(target, content) {
  const tempFile = `${target}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tempFile, content)
  await fs.rename(tempFile, target)
}

function chunk(array, size) {
  const groups = []
  for (let index = 0; index < array.length; index += size) groups.push(array.slice(index, index + size))
  return groups
}

async function createOfficialUtilityEntries(packageVersion) {
  const designSystem = await loadTailwindDesignSystem()
  const classList = designSystem.getClassList()
  const lookup = classList.map(([className, meta]) => ({
    className,
    modifiers: Array.isArray(meta?.modifiers) ? meta.modifiers.filter(Boolean).map(String) : [],
  }))
  const batches = chunk(lookup, 400)
  const items = []

  for (const batch of batches) {
    const cssList = designSystem.candidatesToCss(batch.map((entry) => entry.className))
    for (let index = 0; index < batch.length; index += 1) {
      const entry = batch[index]
      const css = cssList[index]
      if (!css) continue
      const parsed = [...designSystem.parseCandidate(entry.className)][0] ?? null
      const output = extractRuleBody(css)
      const category = classifyOfficialUtility(entry.className, output, parsed)
      items.push(
        buildEntry({
          className: entry.className,
          kind: 'utility',
          category,
          intent: describeOfficialIntent(entry.className, category, output, parsed),
          output,
          whenToUse: describeOfficialWhenToUse(category, entry.modifiers),
          packageVersion,
          sourcePackage: 'tailwindcss',
          since: tailwindPackage.version,
          modifiers: entry.modifiers,
        }),
      )
    }
  }

  return items
}

function toMarkdown(items, packageVersion) {
  const lines = []
  lines.push('# TimCSS 原子样式索引')
  lines.push('')
  lines.push('> 本文件由 `scripts/generate-timcss-doc-index.mjs` 自动生成，请不要手工编辑。')
  lines.push('')
  lines.push(`- 索引 schema 版本：\`${schemaVersion}\``)
  lines.push(`- TimCSS 版本：\`${packageVersion}\``)
  lines.push(`- Tailwind 官方版本：\`${tailwindPackage.version}\``)
  lines.push(`- 官方原子覆盖：默认预设下的官方 utility class，全量来自 \`tailwindcss\` 设计系统`)
  lines.push('')
  lines.push('搜索建议：')
  lines.push('')
  lines.push('- 直接搜类名，如 `pb-safe`、`px-4`、`bg-blue-500`')
  lines.push('- 搜问题词，如“按钮高度”“卡片圆角”“左右内边距”“底部安全区”')
  lines.push('- 搜 CSS 属性，如 `padding-inline`、`grid-template-columns`、`box-shadow`')
  lines.push('- 搜来源包，如 `@timcss/preset-mobile`、`tailwindcss`')
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
    if (item.modifiers?.length) lines.push(`- 可用修饰符：\`${item.modifiers.join('` `')}\``)
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

const items = sortItems(
  uniqueItems([
    ...parseUtilities(mobileSource, packageVersion),
    ...parseUtilities(wechatSource, packageVersion),
    ...parseVariants(variantsSource, packageVersion),
    ...(await createOfficialUtilityEntries(packageVersion)),
  ]),
)

const payload = {
  schemaVersion,
  generatedAt: new Date().toISOString(),
  packageVersion,
  items,
}

await fs.mkdir(docsDir, { recursive: true })
await fs.mkdir(path.dirname(docsPublicTarget), { recursive: true })
await writeFileAtomically(jsonTarget, `${JSON.stringify(payload, null, 2)}\n`)
await writeFileAtomically(docsPublicTarget, `${JSON.stringify(payload, null, 2)}\n`)
await writeFileAtomically(mdTarget, `${toMarkdown(items, packageVersion)}\n`)

console.log(
  `[timcss-docs] generated ${path.relative(root, jsonTarget)} and ${path.relative(root, mdTarget)} from TimCSS presets/variants and official tailwindcss utilities`,
)
