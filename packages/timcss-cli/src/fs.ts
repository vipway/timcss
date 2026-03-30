import fs from 'node:fs/promises'

export async function pathExists(file: string) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}
