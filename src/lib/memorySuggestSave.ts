import type { MemorySuggestEntry } from '../types'

export async function saveSuggestedMemories(input: {
  entries: MemorySuggestEntry[]
  selectedIndexes: number[]
  workspace: string | null
  remember: (
    entry: { content: string; category: MemorySuggestEntry['category']; source: 'agent' },
    workspace: string
  ) => Promise<void>
}): Promise<{ saved: number }> {
  if (!input.workspace || input.selectedIndexes.length === 0) return { saved: 0 }

  let saved = 0
  for (const index of [...input.selectedIndexes].sort((a, b) => a - b)) {
    const entry = input.entries[index]
    if (!entry) continue
    await input.remember(
      { content: entry.content, category: entry.category, source: 'agent' },
      input.workspace
    )
    saved += 1
  }

  return { saved }
}
