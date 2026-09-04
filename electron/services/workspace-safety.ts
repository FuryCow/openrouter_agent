import { existsSync, readFileSync } from 'fs'
import { dirname, join, normalize, relative, resolve } from 'path'
import { app } from 'electron'

export const AGENT_APP_WORKSPACE_ERROR =
  'Cannot use the OpenRouter Agent installation folder as a workspace. Open a separate folder for your projects.'

const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+(-[^\s]*r|-[^\s]*f|--recursive|--force)/i,
  /\bdel\s+\/s/i,
  /\brmdir\s+\/s/i,
  /\bformat\s+[a-z]:/i,
  /\bRemove-Item\b[^\n]*-Recurse/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
  /\bgit\s+reset\s+--hard/i
]

let cachedAgentAppRoot: string | null = null

function looksLikeAgentAppRoot(dir: string): boolean {
  try {
    const pkgPath = join(dir, 'package.json')
    if (!existsSync(pkgPath)) return false
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string; main?: string }
    if (pkg.name === 'openrouter-agent') return true
    return (
      typeof pkg.main === 'string' &&
      pkg.main.includes('out/main') &&
      existsSync(join(dir, 'electron.vite.config.ts'))
    )
  } catch {
    return false
  }
}

export function getAgentAppRoot(): string {
  if (cachedAgentAppRoot) return cachedAgentAppRoot

  const candidates: string[] = []

  try {
    let dir = app.getAppPath()
    if (dir.endsWith('.asar')) {
      dir = dirname(dir)
    }
    candidates.push(dir)
    for (let i = 0; i < 4; i++) {
      dir = dirname(dir)
      candidates.push(dir)
    }
  } catch {
    // app not ready yet
  }

  candidates.push(resolve(__dirname, '../..'))

  for (const candidate of candidates) {
    if (looksLikeAgentAppRoot(candidate)) {
      cachedAgentAppRoot = normalize(candidate)
      return cachedAgentAppRoot
    }
  }

  cachedAgentAppRoot = normalize(candidates[0] || process.cwd())
  return cachedAgentAppRoot
}

export function isInsideAgentApp(targetPath: string): boolean {
  const root = getAgentAppRoot()
  const resolved = normalize(resolve(targetPath))
  const rel = relative(root, resolved)
  return rel === '' || (!rel.startsWith('..') && !rel.includes('..'))
}

export function assertAllowedWorkspace(dir: string): void {
  if (!dir) return
  if (isInsideAgentApp(dir)) {
    throw new Error(AGENT_APP_WORKSPACE_ERROR)
  }
}

export function assertPathNotInAgentApp(targetPath: string): void {
  if (isInsideAgentApp(targetPath)) {
    throw new Error(AGENT_APP_WORKSPACE_ERROR)
  }
}

export function assertSafeTerminalCommand(command: string): void {
  const trimmed = command.trim()
  if (!trimmed) {
    throw new Error('Empty command')
  }

  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error(
        'Blocked potentially destructive command. Use a safer alternative or run it manually outside the agent.'
      )
    }
  }
}
