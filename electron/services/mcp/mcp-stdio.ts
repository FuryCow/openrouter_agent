import { dirname, isAbsolute } from 'node:path'

/** npm/npx are .cmd shims on Windows; node is node.exe (no node.cmd). cross-spawn resolves PATHEXT for the rest. */
const WINDOWS_CMD_COMMANDS = new Set(['npx', 'npm'])

const SCRIPT_ARG = /\.(js|cjs|mjs|ts|tsx)$/i

/** cross-spawn usually resolves .cmd, but Electron on Windows often needs explicit .cmd for npx/npm. */
export function resolveStdioCommand(command: string): string {
  if (process.platform !== 'win32') return command
  const trimmed = command.trim()
  if (!trimmed || trimmed.includes('\\') || trimmed.includes('/')) return trimmed
  if (/\.(cmd|exe|bat|com)$/i.test(trimmed)) return trimmed
  if (WINDOWS_CMD_COMMANDS.has(trimmed.toLowerCase())) return `${trimmed}.cmd`
  return trimmed
}

/** When cwd is unset, use the script directory so servers that read files relative to cwd (e.g. credentials.json) work. */
export function inferStdioCwd(config: { args?: string[]; cwd?: string }): string | undefined {
  if (config.cwd?.trim()) return config.cwd
  for (const arg of config.args ?? []) {
    const trimmed = arg?.trim()
    if (!trimmed || !isAbsolute(trimmed) || !SCRIPT_ARG.test(trimmed)) continue
    const scriptDir = dirname(trimmed)
    const base = scriptDir.replace(/\\/g, '/').split('/').pop()
    if (base === 'dist') return dirname(scriptDir)
    return scriptDir
  }
  return undefined
}

export function normalizeStdioConfig<
  T extends { command?: string; args?: string[]; cwd?: string }
>(config: T): T {
  if (!config.command?.trim()) return config
  const cwd = inferStdioCwd(config)
  return {
    ...config,
    command: resolveStdioCommand(config.command),
    ...(cwd ? { cwd } : {})
  }
}