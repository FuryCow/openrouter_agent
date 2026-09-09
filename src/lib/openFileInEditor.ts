import { useFileStore } from '@/stores/fileStore'
import { loadFileForEditor } from '@/lib/loadFileForEditor'
import type {
  DeletedLineHighlight,
  FileDiffPreview,
  InlineDeleteHighlight,
  InlineDiffRange
} from '@/types'

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
  highlightRanges?: FileDiffPreview['highlightRanges']
  inlineRanges?: InlineDiffRange[]
  inlineDeleteHighlights?: InlineDeleteHighlight[]
  deletedLines?: DeletedLineHighlight[]
  modifiedLines?: DeletedLineHighlight[]
  fileDiff?: FileDiffPreview
  persistent?: boolean
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

  const highlightRanges = options?.highlightRanges ?? options?.fileDiff?.highlightRanges ?? []
  const inlineRanges = options?.inlineRanges ?? []
  const inlineDeleteHighlights = options?.inlineDeleteHighlights ?? []
  const deletedLines = options?.deletedLines ?? []
  const modifiedLines = options?.modifiedLines ?? []
  const scrollToLine =
    options?.fileDiff?.scrollToLine ??
    options?.scrollToLine ??
    highlightRanges[0]?.startLine ??
    inlineRanges[0]?.line ??
    modifiedLines[0]?.afterLine ??
    deletedLines[0]?.afterLine ??
    1

  if (
    highlightRanges.length > 0 ||
    inlineRanges.length > 0 ||
    inlineDeleteHighlights.length > 0 ||
    deletedLines.length > 0 ||
    modifiedLines.length > 0 ||
    scrollToLine > 1
  ) {
    requestEditorReveal({
      path: existing?.path ?? resolved,
      scrollToLine,
      highlightRanges,
      inlineRanges,
      inlineDeleteHighlights,
      deletedLines,
      modifiedLines,
      persistent: options?.persistent
    })
  }
}

export async function openFileWithRunDiff(
  path: string,
  detail: Pick<
    import('@/types').RunCheckpointFileDetail,
    | 'fileDiff'
    | 'inlineRanges'
    | 'inlineDeleteHighlights'
    | 'deletedLines'
    | 'modifiedLines'
    | 'additionHighlightRanges'
  >
): Promise<void> {
  await openFileInEditor(path, {
    fileDiff: detail.fileDiff,
    highlightRanges: detail.additionHighlightRanges,
    inlineRanges: detail.inlineRanges,
    inlineDeleteHighlights: detail.inlineDeleteHighlights,
    deletedLines: detail.deletedLines,
    modifiedLines: detail.modifiedLines,
    persistent: true
  })
}
