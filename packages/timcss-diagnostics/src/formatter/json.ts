import type { TimcssDiagnostic } from '@timcss/core'

export function formatDiagnosticsJson(items: TimcssDiagnostic[]): string {
  return JSON.stringify(items, null, 2)
}
