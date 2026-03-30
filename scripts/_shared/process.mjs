import { spawnSync } from 'node:child_process'

export function runCommandSync(command, args = [], options = {}) {
  let result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ? { ...process.env, ...options.env } : undefined,
    encoding: options.encoding,
    stdio: options.stdio ?? 'inherit',
    shell: options.shell,
  })

  let status = result.status ?? 1
  if (status === 0) return result

  if (options.echoOutputOnFailure) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  }

  if (options.exitOnFailure) process.exit(status)

  if (typeof options.formatError === 'function') {
    throw new Error(options.formatError({ command, args, result, status }))
  }

  throw new Error(`Command failed (${status}): ${[command, ...args].join(' ')}`)
}
