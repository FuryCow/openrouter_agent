import { dirname, isAbsolute } from 'node:path'

/** npm/npx are .cmd shims on Windows; node is node.exe (no node.cmd). cross-spawn resolves PATHEXT for the rest. */
const WINDOWS_CMD_COMMANDS = new Set(['npx', 'npm'])

const SCRIPT_ARG = /\.(js|cjs|mjs|ts|tsx)$/i
const WIN_DRIVE_PATH = /^[A-Za-z]:[/\\]/

function isAbsoluteScriptPath(filePath: string): boolean {
  return isAbsolute(filePath) || WIN_DRIVE_PATH.test(filePath)
}

function scriptDirname(filePath: string): string {
  if (WIN_DRIVE_PATH.test(filePath)) {
    const normalized = filePath.replace(/\\/g, '/')
    const parts = normalized.split('/')
    parts.pop()
    return parts.join('/')
  }
  return dirname(filePath)
}

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
    if (!trimmed || !isAbsoluteScriptPath(trimmed) || !SCRIPT_ARG.test(trimmed)) continue
    const scriptDir = scriptDirname(trimmed)
    const base = scriptDir.replace(/\\/g, '/').split('/').pop()
    if (base === 'dist') return scriptDirname(scriptDir)
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