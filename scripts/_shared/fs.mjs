import fs from 'node:fs/promises'

export async function pathExists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}
