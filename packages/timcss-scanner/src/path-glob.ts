import path from 'node:path'

export function normalizePathSlashes(input: string) {
  return input.replace(/\\/g, '/')
}

export function globPatternToRegExp(pattern: string): RegExp {
  let normalized = normalizePathSlashes(pattern)
  normalized = normalized.replace(/\{([^}]+)\}/g, (_, inner) => `(${inner.split(',').join('|')})`)
  let escaped = normalized.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
  escaped = escaped.replace(/\\\(([^)]+)\\\)/g, '($1)')
  escaped = escaped.replace(/\\\|/g, '|')
  escaped = escaped.replace(/\*\*\//g, '::GLOBSTAR_DIR::')
  escaped = escaped.replace(/\*\*/g, '::DOUBLE_STAR::')
  escaped = escaped.replace(/\*/g, '[^/]*')
  escaped = escaped.replace(/::GLOBSTAR_DIR::/g, '(?:.*/)?')
  escaped = escaped.replace(/::DOUBLE_STAR::/g, '.*')
  return new RegExp(`^${escaped}$`)
}

export function extractStaticContentRoot(pattern: string) {
  let normalized = normalizePathSlashes(pattern)
  let dynamicIndex = normalized.search(/[*[{]/)
  let staticPrefix = dynamicIndex === -1 ? normalized : normalized.slice(0, dynamicIndex)
  staticPrefix = staticPrefix.replace(/\/+$/g, '')
  if (!staticPrefix) return '.'
  return path.posix.extname(staticPrefix) ? path.posix.dirname(staticPrefix) : staticPrefix
}
