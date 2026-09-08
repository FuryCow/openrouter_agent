import type { ProjectMemoryCategory, ProjectMemoryEntry } from './project-memory-types'

export const MEMORY_CATEGORY_CAPS: Record<ProjectMemoryCategory, number> = {
  architecture: 12,
  decision: 15,
  bug: 10,
  convention: 10,
  note: 25
}

function normalizeContent(content: string): string {
  return content.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function areSimilarMemoryEntries(a: string, b: string): boolean {
  const left = normalizeContent(a)
  const right = normalizeContent(b)
  if (!left || !right) return false
  if (left === right) return true
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left]
  return shorter.length >= 16 && longer.includes(shorter)
}

export function dedupeMemoryEntries(entries: ProjectMemoryEntry[]): ProjectMemoryEntry[] {
  const kept: ProjectMemoryEntry[] = []

  for (const entry of entries) {
    const duplicate = kept.some((existing) =>
      areSimilarMemoryEntries(existing.content, entry.content)
    )
    if (!duplicate) kept.push(entry)
  }

  return kept
}

export function applyCategoryCaps(entries: ProjectMemoryEntry[]): ProjectMemoryEntry[] {
  const grouped = new Map<ProjectMemoryCategory, ProjectMemoryEntry[]>()

  for (const entry of entries) {
    const list = grouped.get(entry.category) ?? []
    list.push(entry)
    grouped.set(entry.category, list)
  }

  const capped: ProjectMemoryEntry[] = []

  for (const [category, list] of grouped.entries()) {
    const cap = MEMORY_CATEGORY_CAPS[category]
    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    capped.push(...sorted.slice(0, cap))
  }

  return capped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function applyMemoryHygiene(entries: ProjectMemoryEntry[]): ProjectMemoryEntry[] {
  return applyCategoryCaps(dedupeMemoryEntries(entries))
}
