import { describe, expect, it } from 'vitest'
import {
  applyCategoryCaps,
  applyMemoryHygiene,
  dedupeMemoryEntries
} from './memory-hygiene'
import type { ProjectMemoryEntry } from './project-memory-types'

function entry(
  content: string,
  category: ProjectMemoryEntry['category'],
  createdAt: string
): ProjectMemoryEntry {
  return {
    id: `${category}-${createdAt}`,
    category,
    content,
    source: 'agent',
    createdAt
  }
}

describe('memory-hygiene', () => {
  it('removes near-duplicate entries', () => {
    const cleaned = dedupeMemoryEntries([
      entry('Use Vitest for unit tests in this repo', 'convention', '2026-01-02T00:00:00.000Z'),
      entry('Use Vitest for unit tests', 'convention', '2026-01-01T00:00:00.000Z')
    ])

    expect(cleaned).toHaveLength(1)
  })

  it('caps entries per category keeping newest', () => {
    const entries = Array.from({ length: 30 }, (_, index) =>
      entry(`note ${index}`, 'note', `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`)
    )

    const capped = applyCategoryCaps(entries)
    expect(capped).toHaveLength(25)
    expect(capped[0].content).toBe('note 29')
  })

  it('applies dedupe then caps', () => {
    const cleaned = applyMemoryHygiene([
      entry('Indexer uses SQLite', 'architecture', '2026-02-01T00:00:00.000Z'),
      entry('Indexer uses SQLite for workspace indexing', 'architecture', '2026-02-02T00:00:00.000Z'),
      entry('Another architecture note', 'architecture', '2026-02-03T00:00:00.000Z')
    ])

    expect(cleaned).toHaveLength(2)
  })
})
