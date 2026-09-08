import { useFileStore } from '@/stores/fileStore'
import { loadFileForEditor } from '@/lib/loadFileForEditor'
import type { DiffHighlightRange } from '@/types'

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function resolveEditorPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return trimmed

  const asPosix = trimmed.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(asPosix) || asPosix.startsWith('/')) {
    return trimmed
  }

  const workingDirectory = useFileStore.getState().workingDirectory
  if (!workingDirectory) return trimmed

  const base = workingDirectory.replace(/\\/g, '/').replace(/\/$/, '')
  const relative = asPosix.replace(/^\//, '')
  return `${base}/${relative}`
}

export type OpenFileOptions = {
  scrollToLine?: number
  highlightRanges?: DiffHighlightRange[]
}

export async function openFileInEditor(path: string, options?: OpenFileOptions): Promise<void> {
  const resolved = resolveEditorPath(path)
  const { tabs, openFile, setActiveTab, replaceTabContent, requestEditorReveal } =
    useFileStore.getState()
  const target = normalizePath(resolved)

  const content = await loadFileForEditor(resolved)
  const existing = tabs.find((tab) => normalizePath(tab.path) === target)

  if (existing) {
    replaceTabContent(existing.path, content)
    setActiveTab(existing.path)
  } else {
    openFile(resolved, content)
  }

  if (options?.scrollToLine || (options?.highlightRanges && options.highlightRanges.length > 0)) {
    requestEditorReveal({
      path: existing?.path ?? resolved,
      scrollToLine: options.scrollToLine ?? options.highlightRanges?.[0]?.startLine ?? 1,
      highlightRanges: options.highlightRanges ?? []
    })
  }
}
