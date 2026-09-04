import { existsSync, readFileSync } from 'fs'
import { dirname, join, normalize, resolve, sep } from 'path'
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

/** Shell patterns used to search/grep source — use grep_workspace or codebase_search instead. */
export const CODE_SEARCH_SHELL_PATTERNS = [
  /\b(rg|ripgrep)\b/i,
  /\bgrep\b/i,
  /\bgit\s+grep\b/i,
  /\bfindstr\b/i,
  /\bSelect-String\b/i,
  /\bwhere\s+\/r\b/i,
  /\bGet-ChildItem\b[^\n|]*-Recurse[^\n|]*\|\s*Select-String/i,
  /\bfind\b[^\n]*(-exec|\bxargs\b)[^\n]*\bgrep\b/i
]

export function isCodeSearchShellCommand(command: string): boolean {
  const trimmed = command.trim()
  if (!trimmed) return false
  return CODE_SEARCH_SHELL_PATTERNS.some((pattern) => pattern.test(trimmed))
}

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

  cachedAgentAppRoot = normalize(candidates[0] ?? process.cwd())
  return cachedAgentAppRoot
}
export function isPathInside(parent: string, child: string): boolean {
  const parentResolved = normalize(resolve(parent))
  const childResolved = normalize(resolve(child))

  if (process.platform === 'win32') {
    const parentLower = parentResolved.toLowerCase()
    const childLower = childResolved.toLowerCase()
    if (childLower === parentLower) return true
    const prefix = parentLower.endsWith('\\') ? parentLower : `${parentLower}\\`
    return childLower.startsWith(prefix)
  }

  if (childResolved === parentResolved) return true
  const prefix = parentResolved.endsWith(sep) ? parentResolved : `${parentResolved}${sep}`
  return childResolved.startsWith(prefix)
}

export function isInsideAgentApp(targetPath: string): boolean {
  return isPathInside(getAgentAppRoot(), targetPath)
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

  if (isCodeSearchShellCommand(trimmed)) {
    throw new Error(
      'Blocked: do not use the shell to search or grep source files. Use grep_workspace (regex) or codebase_search (hybrid navigation) instead.'
    )
  }

  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error(
        'Blocked potentially destructive command. Use a safer alternative or run it manually outside the agent.'
      )
    }
  }
}
