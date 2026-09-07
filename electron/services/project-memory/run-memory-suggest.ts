import type { TimelineItem } from '../../types'
import type { ProjectMemoryCategory } from './project-memory-types'

export interface MemorySuggestEntry {
  content: string
  category: ProjectMemoryCategory
}

const FILE_TOOLS = new Set(['write_file', 'search_replace'])

function extractSummary(finalContent: string): string | null {
  const trimmed = finalContent.trim()
  if (!trimmed) return null

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const bulletLines = lines.filter((line) => /^[-*•]\s+/.test(line)).slice(0, 3)
  if (bulletLines.length > 0) {
    return bulletLines.map((line) => line.replace(/^[-*•]\s+/, '')).join('; ').slice(0, 400)
  }

  const paragraph = trimmed.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim()
  if (!paragraph || paragraph.length < 40) return null
  return paragraph.slice(0, 400)
}

export function suggestMemoryFromRun(
  timeline: TimelineItem[],
  finalContent: string
): MemorySuggestEntry[] {
  const suggestions: MemorySuggestEntry[] = []
  const seen = new Set<string>()

  const changedPaths = timeline
    .filter((item): item is Extract<TimelineItem, { type: 'tool' }> => item.type === 'tool')
    .filter(
      (item) =>
        item.toolCall.status === 'done' &&
        FILE_TOOLS.has(item.toolCall.name) &&
        Boolean(item.toolCall.filePath?.trim())
    )
    .map((item) => item.toolCall.filePath!.trim())

  const uniquePaths = [...new Set(changedPaths)]
  if (uniquePaths.length > 0) {
    const content = `Changed files in last run: ${uniquePaths.slice(0, 6).join(', ')}`
    suggestions.push({ content, category: 'note' })
    seen.add(content)
  }

  const hadMemoryWrite = timeline.some(
    (item) =>
      item.type === 'tool' &&
      item.toolCall.name === 'update_project_memory' &&
      item.toolCall.status === 'done'
  )

  if (!hadMemoryWrite) {
    const summary = extractSummary(finalContent)
    if (summary && !seen.has(summary)) {
      suggestions.push({ content: summary, category: 'decision' })
      seen.add(summary)
    }
  }

  return suggestions.slice(0, 3)
}
