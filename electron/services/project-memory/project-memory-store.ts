import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { getMemoryJsonPath } from './memory-paths'
import type {
  ProjectMemoryCategory,
  ProjectMemoryEntry,
  ProjectMemoryFile,
  ProjectMemorySource,
  RememberMemoryInput,
  UpdateProjectMemoryInput
} from './project-memory-types'

function emptyFile(): ProjectMemoryFile {
  return { version: 1, entries: [] }
}

function parseMemoryFile(raw: string): ProjectMemoryFile {
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectMemoryFile>
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return emptyFile()
    const entries = parsed.entries
      .filter(
        (entry): entry is ProjectMemoryEntry =>
          Boolean(entry) &&
          typeof entry.id === 'string' &&
          typeof entry.content === 'string' &&
          typeof entry.category === 'string' &&
          typeof entry.source === 'string' &&
          typeof entry.createdAt === 'string'
      )
      .map((entry) => ({
        id: entry.id,
        category: entry.category,
        content: entry.content.trim(),
        source: entry.source,
        createdAt: entry.createdAt
      }))
      .filter((entry) => entry.content.length > 0)
    return { version: 1, entries }
  } catch {
    return emptyFile()
  }
}

export class ProjectMemoryStore {
  constructor(private userDataPath: string) {}

  load(workspacePath: string): ProjectMemoryFile {
    const filePath = getMemoryJsonPath(this.userDataPath, workspacePath)
    if (!existsSync(filePath)) return emptyFile()
    try {
      return parseMemoryFile(readFileSync(filePath, 'utf-8'))
    } catch {
      return emptyFile()
    }
  }

  save(workspacePath: string, file: ProjectMemoryFile): void {
    const filePath = getMemoryJsonPath(this.userDataPath, workspacePath)
    writeFileSync(filePath, `${JSON.stringify(file, null, 2)}\n`, 'utf-8')
  }

  listEntries(workspacePath: string): ProjectMemoryEntry[] {
    return this.load(workspacePath).entries
  }

  saveEntries(workspacePath: string, entries: ProjectMemoryEntry[]): ProjectMemoryEntry[] {
    const normalized = entries
      .filter((entry) => entry.content.trim().length > 0)
      .map((entry) => ({
        ...entry,
        content: entry.content.trim()
      }))
    this.save(workspacePath, { version: 1, entries: normalized })
    return normalized
  }

  remember(workspacePath: string, input: RememberMemoryInput): ProjectMemoryEntry {
    const file = this.load(workspacePath)
    const entry: ProjectMemoryEntry = {
      id: randomUUID(),
      category: input.category ?? 'note',
      content: input.content.trim(),
      source: input.source ?? 'remember',
      createdAt: new Date().toISOString()
    }
    file.entries.unshift(entry)
    this.save(workspacePath, file)
    return entry
  }

  update(workspacePath: string, input: UpdateProjectMemoryInput): ProjectMemoryEntry | null {
    const file = this.load(workspacePath)

    if (input.action === 'append') {
      const content = input.content?.trim()
      if (!content) throw new Error('content is required for append')
      const entry: ProjectMemoryEntry = {
        id: randomUUID(),
        category: input.category ?? 'note',
        content,
        source: input.source ?? 'agent',
        createdAt: new Date().toISOString()
      }
      file.entries.unshift(entry)
      this.save(workspacePath, file)
      return entry
    }

    if (input.action === 'update') {
      const id = input.id?.trim()
      const content = input.content?.trim()
      if (!id) throw new Error('id is required for update')
      if (!content) throw new Error('content is required for update')
      const index = file.entries.findIndex((entry) => entry.id === id)
      if (index === -1) throw new Error(`Memory entry not found: ${id}`)
      const existing = file.entries[index]
      const updated: ProjectMemoryEntry = {
        ...existing,
        content,
        category: input.category ?? existing.category
      }
      file.entries[index] = updated
      this.save(workspacePath, file)
      return updated
    }

    if (input.action === 'delete') {
      const id = input.id?.trim()
      if (!id) throw new Error('id is required for delete')
      const before = file.entries.length
      file.entries = file.entries.filter((entry) => entry.id !== id)
      if (file.entries.length === before) throw new Error(`Memory entry not found: ${id}`)
      this.save(workspacePath, file)
      return null
    }

    throw new Error(`Unknown action: ${String(input.action)}`)
  }
}
