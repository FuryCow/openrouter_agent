const WINDOWS_CMD_COMMANDS = new Set(['npx', 'npm', 'node', 'pnpm', 'yarn', 'deno'])

/** cross-spawn usually resolves .cmd, but Electron on Windows often needs explicit .cmd for npx/npm. */
export function resolveStdioCommand(command: string): string {
  if (process.platform !== 'win32') return command
  const trimmed = command.trim()
  if (!trimmed || trimmed.includes('\\') || trimmed.includes('/')) return trimmed
  if (/\.(cmd|exe|bat|com)$/i.test(trimmed)) return trimmed
  if (WINDOWS_CMD_COMMANDS.has(trimmed.toLowerCase())) return `${trimmed}.cmd`
  return trimmed
}

export function normalizeStdioConfig<T extends { command?: string }>(config: T): T {
  if (!config.command?.trim()) return config
  return { ...config, command: resolveStdioCommand(config.command) }
}
