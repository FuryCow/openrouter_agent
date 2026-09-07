import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { MAX_DOC_BYTES } from './project-memory-types'

export interface WorkspaceDoc {
  path: string
  content: string
}

export interface LoadWorkspaceDocsOptions {
  includeCursorRules?: boolean
}

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw
  const end = raw.indexOf('---', 3)
  if (end === -1) return raw
  return raw.slice(end + 3).trimStart()
}

function readDocFile(absolutePath: string, displayPath: string): WorkspaceDoc | null {
  if (!existsSync(absolutePath)) return null
  try {
    const raw = readFileSync(absolutePath, 'utf-8')
    const body = stripFrontmatter(raw)
    const truncated =
      body.length > MAX_DOC_BYTES
        ? `${body.slice(0, MAX_DOC_BYTES)}\n...[truncated ${body.length - MAX_DOC_BYTES} chars]`
        : body
    const trimmed = truncated.trim()
    if (!trimmed) return null
    return { path: displayPath, content: trimmed }
  } catch {
    return null
  }
}

function loadCursorRules(workspacePath: string): WorkspaceDoc[] {
  const rulesDir = join(workspacePath, '.cursor', 'rules')
  if (!existsSync(rulesDir)) return []

  let names: string[] = []
  try {
    names = readdirSync(rulesDir)
      .filter((name) => {
        const lower = name.toLowerCase()
        return lower.endsWith('.md') || lower.endsWith('.mdc')
      })
      .sort()
  } catch {
    return []
  }

  const docs: WorkspaceDoc[] = []
  for (const name of names) {
    const doc = readDocFile(join(rulesDir, name), `.cursor/rules/${name}`)
    if (doc) docs.push(doc)
  }
  return docs
}

export function loadWorkspaceDocs(
  workspacePath: string,
  options: LoadWorkspaceDocsOptions = {}
): WorkspaceDoc[] {
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

  if (options.includeCursorRules !== false) {
    docs.push(...loadCursorRules(workspacePath))
  }

  return docs
}

export function isProjectMemoryDocPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase()
  return (
    normalized === 'agents.md' ||
    (normalized.startsWith('.openrouter/') && normalized.endsWith('.md')) ||
    (normalized.startsWith('.cursor/rules/') &&
      (normalized.endsWith('.md') || normalized.endsWith('.mdc')))
  )
}
