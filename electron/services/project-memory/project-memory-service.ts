import { hashWorkspacePath } from '../indexing/index-paths'
import { trimToTokenBudget } from '../../lib/tokens'
import { ProjectMemoryStore } from './project-memory-store'
import { isProjectMemoryDocPath, loadWorkspaceDocs } from './workspace-docs'
import type {
  ProjectMemoryEntry,
  ProjectMemorySnapshotOptions,
  ReadProjectMemoryInput,
  RememberMemoryInput,
  UpdateProjectMemoryInput
} from './project-memory-types'
import { DEFAULT_SNAPSHOT_TOKEN_BUDGET } from './project-memory-types'
import { applyMemoryHygiene } from './memory-hygiene'

export class ProjectMemoryService {
  private cache = new Map<string, string>()

  constructor(
    private userDataPath: string,
    private store = new ProjectMemoryStore(userDataPath)
  ) {}

  invalidate(workspacePath: string): void {
    const hash = hashWorkspacePath(workspacePath)
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${hash}:`)) {
        this.cache.delete(key)
      }
    }
  }

  invalidateByChangedPaths(workspacePath: string, changedPaths: string[]): void {
    if (changedPaths.some((path) => isProjectMemoryDocPath(path))) {
      this.invalidate(workspacePath)
    }
  }

  listEntries(workspacePath: string): ProjectMemoryEntry[] {
    const entries = this.store.listEntries(workspacePath)
    const cleaned = applyMemoryHygiene(entries)
    if (cleaned.length !== entries.length) {
      this.store.saveEntries(workspacePath, cleaned)
      this.invalidate(workspacePath)
    }
    return cleaned
  }

  saveEntries(workspacePath: string, entries: ProjectMemoryEntry[]): ProjectMemoryEntry[] {
    const saved = this.store.saveEntries(workspacePath, applyMemoryHygiene(entries))
    this.invalidate(workspacePath)
    return saved
  }

  remember(workspacePath: string, input: RememberMemoryInput): ProjectMemoryEntry {
    const entry = this.store.remember(workspacePath, input)
    const cleaned = applyMemoryHygiene(this.store.listEntries(workspacePath))
    this.store.saveEntries(workspacePath, cleaned)
    this.invalidate(workspacePath)
    return cleaned.find((item) => item.id === entry.id) ?? entry
  }

  update(workspacePath: string, input: UpdateProjectMemoryInput): ProjectMemoryEntry | null {
    const entry = this.store.update(workspacePath, input)
    const cleaned = applyMemoryHygiene(this.store.listEntries(workspacePath))
    this.store.saveEntries(workspacePath, cleaned)
    this.invalidate(workspacePath)
    if (input.action === 'delete') return null
    return cleaned.find((item) => item.id === entry?.id) ?? entry
  }

  read(workspacePath: string, input: ReadProjectMemoryInput = {}): string {
    let entries = this.listEntries(workspacePath)
    if (input.category) {
      entries = entries.filter((entry) => entry.category === input.category)
    }
    if (input.query?.trim()) {
      const query = input.query.trim().toLowerCase()
      entries = entries.filter((entry) => entry.content.toLowerCase().includes(query))
    }

    const docs = loadWorkspaceDocs(workspacePath)
    const parts: string[] = []

    if (docs.length > 0) {
      parts.push('Workspace docs (read-only):')
      for (const doc of docs) {
        parts.push(`## ${doc.path}\n${doc.content}`)
      }
    }

    if (entries.length === 0) {
      parts.push('Dynamic memory entries: none')
    } else {
      parts.push('Dynamic memory entries:')
      for (const entry of entries) {
        parts.push(
          `- [${entry.category}] (${entry.id}) ${entry.createdAt}\n  ${entry.content.replace(/\n/g, '\n  ')}`
        )
      }
    }

    return parts.join('\n\n')
  }

  getSnapshot(workspacePath: string, options: ProjectMemorySnapshotOptions = {}): string {
    const hash = hashWorkspacePath(workspacePath)
    const includeDocs = options.includeDocs !== false
    const includeCursorRules = options.includeCursorRules !== false
    const cacheKey = `${hash}:${includeDocs ? 'docs' : 'nodocs'}:${includeCursorRules ? 'cursor' : 'nocursor'}`
    const cached = this.cache.get(cacheKey)
    if (cached !== undefined) return cached

    const parts: string[] = []

    if (includeDocs) {
      const docs = loadWorkspaceDocs(workspacePath, { includeCursorRules })
      if (docs.length > 0) {
        parts.push('## Workspace docs')
        for (const doc of docs) {
          parts.push(`### ${doc.path}\n${doc.content}`)
        }
      }
    }

    const entries = this.listEntries(workspacePath)
    if (entries.length > 0) {
      parts.push('## Dynamic memory')
      const grouped = new Map<string, ProjectMemoryEntry[]>()
      for (const entry of entries) {
        const list = grouped.get(entry.category) ?? []
        list.push(entry)
        grouped.set(entry.category, list)
      }

      for (const category of ['architecture', 'decision', 'bug', 'convention', 'note']) {
        const list = grouped.get(category)
        if (!list?.length) continue
        parts.push(`### ${category}`)
        for (const entry of list) {
          parts.push(`- ${entry.content}`)
        }
      }
    }

    const merged = parts.length > 0 ? parts.join('\n\n') : 'No project memory yet.'
    const budget = options.tokenBudget ?? DEFAULT_SNAPSHOT_TOKEN_BUDGET
    const snapshot = trimToTokenBudget(merged, budget)
    this.cache.set(cacheKey, snapshot)
    return snapshot
  }
}
