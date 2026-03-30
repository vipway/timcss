import { watch as watchDirectory, type FSWatcher } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { normalizePathSlashes } from '@timcss/scanner'
import { pathExists } from './fs'

export type TimcssWatchBackendKind = 'auto' | 'native' | 'polling'
export type TimcssResolvedWatchBackendKind = Exclude<TimcssWatchBackendKind, 'auto'>

export interface TimcssWatchHandle {
  backend: TimcssResolvedWatchBackendKind
  close(): Promise<void>
}

export interface TimcssWatchOptions {
  backend?: TimcssWatchBackendKind
  directories: string[]
  ignorePaths?: string[]
  pollIntervalMs?: number
  onChange(paths: string[]): void
  onError(error: Error): void
}

function isSameOrChildPath(parent: string, candidate: string) {
  let relative = path.relative(parent, candidate)
  return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function shouldIgnorePath(file: string, ignoredPaths: string[]) {
  let absolute = path.resolve(file)
  return ignoredPaths.some((ignored) => isSameOrChildPath(path.resolve(ignored), absolute))
}

async function walkDirectory(dir: string, ignoredPaths: string[]): Promise<Map<string, number>> {
  let snapshot = new Map<string, number>()
  let entries = await fs.readdir(dir, { withFileTypes: true })
  for (let entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    let full = path.join(dir, entry.name)
    if (shouldIgnorePath(full, ignoredPaths)) continue
    if (entry.isDirectory()) {
      for (let [file, mtimeMs] of await walkDirectory(full, ignoredPaths)) snapshot.set(file, mtimeMs)
      continue
    }
    if (!entry.isFile()) continue
    let stat = await fs.stat(full)
    snapshot.set(path.resolve(full), stat.mtimeMs)
  }
  return snapshot
}

async function captureSnapshot(directories: string[], ignoredPaths: string[]) {
  let snapshot = new Map<string, number>()
  for (let directory of directories) {
    if (!(await pathExists(directory))) continue
    for (let [file, mtimeMs] of await walkDirectory(directory, ignoredPaths)) snapshot.set(file, mtimeMs)
  }
  return snapshot
}

function diffSnapshots(previous: Map<string, number>, next: Map<string, number>) {
  let changed = new Set<string>()
  for (let [file, mtimeMs] of next) {
    if (!previous.has(file) || previous.get(file) !== mtimeMs) changed.add(file)
  }
  for (let file of previous.keys()) {
    if (!next.has(file)) changed.add(file)
  }
  return [...changed]
}

async function createNativeWatchHandle(options: TimcssWatchOptions): Promise<TimcssWatchHandle> {
  let watchers: FSWatcher[] = []
  try {
    for (let directory of options.directories) {
      let activeWatcher = watchDirectory(directory, { recursive: true }, (_eventType, changedPath) => {
        if (!changedPath) return
        let absolute = path.resolve(directory, String(changedPath))
        if (shouldIgnorePath(absolute, options.ignorePaths ?? [])) return
        options.onChange([absolute])
      })
      activeWatcher.on('error', (error) => {
        options.onError(error)
      })
      watchers.push(activeWatcher)
    }
    return {
      backend: 'native',
      async close() {
        for (let watcher of watchers.splice(0)) watcher.close()
      },
    }
  } catch (error) {
    for (let watcher of watchers.splice(0)) watcher.close()
    throw error
  }
}

async function createPollingWatchHandle(options: TimcssWatchOptions): Promise<TimcssWatchHandle> {
  let intervalMs = Math.max(50, options.pollIntervalMs ?? 200)
  let ignoredPaths = options.ignorePaths ?? []
  let snapshot = await captureSnapshot(options.directories, ignoredPaths)
  let closed = false
  let running = false
  let rerunRequested = false

  let tick = async () => {
    if (closed) return
    if (running) {
      rerunRequested = true
      return
    }
    running = true
    try {
      let nextSnapshot = await captureSnapshot(options.directories, ignoredPaths)
      let changed = diffSnapshots(snapshot, nextSnapshot)
      snapshot = nextSnapshot
      if (changed.length > 0) options.onChange(changed)
    } catch (error) {
      options.onError(error instanceof Error ? error : new Error(String(error)))
    } finally {
      running = false
      if (rerunRequested) {
        rerunRequested = false
        void tick()
      }
    }
  }

  let timer = setInterval(() => {
    void tick()
  }, intervalMs)

  return {
    backend: 'polling',
    async close() {
      closed = true
      clearInterval(timer)
    },
  }
}

export async function createTimcssWatchHandle(options: TimcssWatchOptions): Promise<TimcssWatchHandle> {
  let backend = options.backend ?? 'auto'
  if (backend === 'polling') return createPollingWatchHandle(options)
  if (backend === 'native') return createNativeWatchHandle(options)

  try {
    return await createNativeWatchHandle(options)
  } catch (error) {
    options.onError(
      new Error(
        `native watcher unavailable, falling back to polling: ${error instanceof Error ? error.message : String(error)}`,
      ),
    )
    return createPollingWatchHandle(options)
  }
}

export function collapseWatchDirectories(directories: string[]) {
  let sorted = [...new Set(directories.map((dir) => path.resolve(dir)))].sort((left, right) => left.length - right.length)
  let collapsed: string[] = []
  for (let directory of sorted) {
    if (collapsed.some((parent) => isSameOrChildPath(parent, directory))) continue
    collapsed.push(directory)
  }
  return collapsed
}

export function resolveIgnoredWatchPaths(paths: string[]) {
  return [...new Set(paths.map((item) => normalizePathSlashes(path.resolve(item))))]
}
