import type { editor } from 'monaco-editor'
import type { EditorTab } from '@/stores/fileStore'
import {
  countLines,
  formatIndentLabel,
  formatLanguageLabel,
  getContentSizeBytes
} from '@/lib/fileStats'
import type { EditorFileStats } from '@/stores/editorStore'

export function buildEditorFileStats(
  tab: EditorTab,
  editorInstance?: editor.IStandaloneCodeEditor | null,
  options?: { showCursor?: boolean }
): EditorFileStats {
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
