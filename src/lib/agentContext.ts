import type { EditorTab } from '@/stores/fileStore'

export const AGENT_CONTEXT_MAX_FILES = 8
export const AGENT_CONTEXT_MAX_CHARS_PER_FILE = 4000

export interface AgentContextFile {
  path: string
  content: string
  language: string
  truncated: boolean
  pinned: boolean
}

export function truncateFileContent(content: string, maxChars = AGENT_CONTEXT_MAX_CHARS_PER_FILE): {
  content: string
  truncated: boolean
} {
  if (content.length <= maxChars) {
    return { content, truncated: false }
  }
  return {
    content: `${content.slice(0, maxChars)}\n…`,
    truncated: true
  }
}

export function buildAgentContextFiles(
  tabs: EditorTab[],
  options: {
    pinnedPaths: string[]
    excludedPaths: string[]
    activeTabPath: string | null
  }
): AgentContextFile[] {
  const excluded = new Set(options.excludedPaths)
  const pinnedOrder = options.pinnedPaths.filter((path) => !excluded.has(path))
  const pinnedSet = new Set(pinnedOrder)

  const tabByPath = new Map(tabs.map((tab) => [tab.path, tab]))
  const orderedPaths: string[] = []

  for (const path of pinnedOrder) {
    if (tabByPath.has(path)) orderedPaths.push(path)
  }

  if (options.activeTabPath && !excluded.has(options.activeTabPath) && !pinnedSet.has(options.activeTabPath)) {
    orderedPaths.push(options.activeTabPath)
  }

  for (const tab of tabs) {
    if (excluded.has(tab.path)) continue
    if (orderedPaths.includes(tab.path)) continue
    orderedPaths.push(tab.path)
  }

  return orderedPaths.slice(0, AGENT_CONTEXT_MAX_FILES).flatMap((path) => {
    const tab = tabByPath.get(path)
    if (!tab) return []
    const { content, truncated } = truncateFileContent(tab.content)
    return [
      {
        path: tab.path,
        content,
        language: tab.language,
        truncated,
        pinned: pinnedSet.has(path)
      }
    ]
  })
}

export function buildAgentOpenFilesPayload(
  files: AgentContextFile[]
): Array<{ path: string; content: string; language: string }> {
  return files.map(({ path, content, language }) => ({ path, content, language }))
}
