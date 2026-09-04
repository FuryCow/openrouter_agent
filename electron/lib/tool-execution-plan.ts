import { join, isAbsolute } from 'path'
import type { ToolCall } from '../services/openrouter'

export function resolveWorkspacePath(filePath: string, cwd: string): string {
  if (!filePath) return cwd
  return isAbsolute(filePath) ? filePath : join(cwd, filePath)
}

export function getAffectedPaths(call: ToolCall, cwd: string): string[] {
  let args: Record<string, unknown>
  try {
    args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
  } catch {
    return []
  }

  switch (call.function.name) {
    case 'read_file':
    case 'write_file':
    case 'search_replace': {
      const path = String(args.path ?? '').trim()
      if (!path) return []
      return [resolveWorkspacePath(path, cwd)]
    }
    case 'read_files': {
      if (!Array.isArray(args.paths)) return []
      return args.paths
        .map((p) => String(p ?? '').trim())
        .filter(Boolean)
        .map((p) => resolveWorkspacePath(p, cwd))
    }
    default:
      return []
  }
}

/** Group tool calls into waves safe for parallel execution (same file → sequential). */
export function buildExecutionWaves(calls: ToolCall[], cwd: string): ToolCall[][] {
  const waves: ToolCall[][] = []
  let current: ToolCall[] = []
  let pathsInWave = new Set<string>()

  const flush = (): void => {
    if (current.length === 0) return
    waves.push(current)
    current = []
    pathsInWave = new Set()
  }

  for (const call of calls) {
    if (call.function.name === 'run_terminal') {
      flush()
      waves.push([call])
      continue
    }

    const paths = getAffectedPaths(call, cwd)
    const conflicts = paths.some((p) => pathsInWave.has(p))
    if (conflicts) flush()

    current.push(call)
    for (const p of paths) pathsInWave.add(p)
  }

  flush()
  return waves
}
