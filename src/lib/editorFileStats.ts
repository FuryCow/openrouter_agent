import type { editor } from 'monaco-editor'
import type { EditorTab } from '@/stores/fileStore'
import {
  countLines,
  formatIndentLabel,
  formatLanguageLabel,
  getContentSizeBytes
} from '@/lib/fileStats'
import { getImageMimeType, isImagePath } from '@/lib/utils'
import type { EditorFileStats } from '@/stores/editorStore'

export function buildEditorFileStats(
  tab: EditorTab,
  editorInstance?: editor.IStandaloneCodeEditor | null,
  options?: { showCursor?: boolean }
): EditorFileStats {
  if (isImagePath(tab.path)) {
    const comma = tab.content.indexOf(',')
    const base64 = comma >= 0 ? tab.content.slice(comma + 1) : tab.content
    const sizeBytes = Math.max(0, Math.floor((base64.length * 3) / 4))

    return {
      path: tab.path,
      line: 1,
      column: 1,
      lineCount: 1,
      indent: '—',
      encoding: getImageMimeType(tab.path).split('/')[1]?.toUpperCase() ?? 'IMAGE',
      eol: '—',
      sizeBytes,
      language: 'Image',
      showCursor: false
    }
  }

  const lineCount = countLines(tab.content)
  const sizeBytes = getContentSizeBytes(tab.content)

  let line = 1
  let column = 1
  let indent = formatIndentLabel(true, 2)
  let eol = 'LF'

  if (editorInstance) {
    const position = editorInstance.getPosition()
    if (position) {
      line = position.lineNumber
      column = position.column
    }

    const model = editorInstance.getModel()
    if (model) {
      const options = model.getOptions()
      indent = formatIndentLabel(options.insertSpaces, options.tabSize)
      eol = model.getEOL() === '\r\n' ? 'CRLF' : 'LF'
    }
  }

  return {
    path: tab.path,
    line,
    column,
    lineCount,
    indent,
    encoding: 'UTF-8',
    eol,
    sizeBytes,
    language: formatLanguageLabel(tab.language),
    showCursor: options?.showCursor ?? Boolean(editorInstance)
  }
}
