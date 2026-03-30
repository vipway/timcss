export const TIMCSS_INTENT_SYNONYMS: Record<string, string[]> = {
  safe: ['安全区', '刘海', 'notch', 'tabbar', '避让', '吸底'],
  control: ['控件', '按钮', '触控', '点击', '交互'],
  card: ['卡片', '面板'],
  layout: ['布局', '间距', '留白', '容器'],
  shadow: ['阴影', '浮层', 'elevated'],
  text: ['文本', '文案', '标题', '说明'],
  pressed: ['按压', '按下'],
  disabled: ['禁用', '不可用'],
  keyboard: ['键盘', '输入'],
}

export function splitTimcssSearchTerms(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s,，、;；/|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeTimcssIntentQuery(value: string): string {
  return value.trim().replace(/^(intent|场景)\s*[:：]\s*/i, '').trim().toLowerCase()
}

export function isTimcssIntentTerm(value: string): boolean {
  let term = value.trim().toLowerCase()
  if (!term) return false

  for (let [key, synonyms] of Object.entries(TIMCSS_INTENT_SYNONYMS)) {
    if (term === key || term.includes(key) || key.includes(term)) return true
    if (synonyms.some((word) => term === word || term.includes(word) || word.includes(term))) return true
  }

  return false
}

export function isTimcssIntentQuery(rawQuery: string): boolean {
  if (/^(intent|场景)\s*[:：]\s*/i.test(rawQuery.trim())) return true
  let terms = splitTimcssSearchTerms(normalizeTimcssIntentQuery(rawQuery))
  return terms.some((term) => isTimcssIntentTerm(term))
}

export function expandTimcssIntentTerms(value: string): string[] {
  let seedTerms = splitTimcssSearchTerms(normalizeTimcssIntentQuery(value))
  let terms = new Set(seedTerms)

  for (let term of seedTerms) {
    for (let [key, synonyms] of Object.entries(TIMCSS_INTENT_SYNONYMS)) {
      let matchesKey = term === key || term.includes(key) || key.includes(term)
      let matchesSynonym = synonyms.some((word) => term === word || term.includes(word) || word.includes(term))
      if (!matchesKey && !matchesSynonym) continue
      terms.add(key)
      for (let word of synonyms) terms.add(word.toLowerCase())
    }
  }

  return [...terms]
}

export function includesTimcssTerm(text: string, term: string): boolean {
  return text.toLowerCase().includes(term.toLowerCase())
}
