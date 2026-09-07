import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { MAX_DOC_BYTES } from './project-memory-types'

export interface WorkspaceDoc {
  path: string
  content: string
}

function readDocFile(absolutePath: string, displayPath: string): WorkspaceDoc | null {
  if (!existsSync(absolutePath)) return null
  try {
    const raw = readFileSync(absolutePath, 'utf-8')
    const truncated =
      raw.length > MAX_DOC_BYTES
        ? `${raw.slice(0, MAX_DOC_BYTES)}\n...[truncated ${raw.length - MAX_DOC_BYTES} chars]`
        : raw
    const trimmed = truncated.trim()
    if (!trimmed) return null
    return { path: displayPath, content: trimmed }
  } catch {
    return null
  }
}

export function loadWorkspaceDocs(workspacePath: string): WorkspaceDoc[] {
  const docs: WorkspaceDoc[] = []

  const agentsMd = readDocFile(join(workspacePath, 'AGENTS.md'), 'AGENTS.md')
  if (agentsMd) docs.push(agentsMd)

  const openrouterDir = join(workspacePath, '.openrouter')
  if (existsSync(openrouterDir)) {
    let names: string[] = []
    try {
      names = readdirSync(openrouterDir)
        .filter((name) => name.toLowerCase().endsWith('.md'))
        .sort()
    } catch {
      names = []
    }

    for (const name of names) {
      const doc = readDocFile(join(openrouterDir, name), `.openrouter/${name}`)
      if (doc) docs.push(doc)
    }
  }

  return docs
}

export function isProjectMemoryDocPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase()
  return normalized === 'agents.md' || normalized.startsWith('.openrouter/') && normalized.endsWith('.md')
}
