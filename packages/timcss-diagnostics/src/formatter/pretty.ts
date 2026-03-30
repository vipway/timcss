import type { TimcssDiagnostic } from '@timcss/core'

export function formatDiagnosticsPretty(items: TimcssDiagnostic[]): string {
  if (items.length === 0) return 'No diagnostics.'
  return items
    .map((item) => {
      let where = item.file ? ` (${item.file})` : ''
      let className = item.className ? ` ${item.className}` : ''
      let suggestion = item.suggestion ? `\n  suggestion: ${item.suggestion}` : ''
      let catalog =
        item.catalogMatches && item.catalogMatches.length > 0
          ? `\n  catalog: ${item.catalogMatches
              .map((entry) => `${entry.className} [${entry.status}] <${entry.sourcePackage}> platforms=${entry.platforms.join('/')}`)
              .join('; ')}`
          : ''
      return `[${item.level}] ${item.code}${where}${className}\n  ${item.message}${suggestion}${catalog}`
    })
    .join('\n')
}
