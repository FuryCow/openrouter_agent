import { useTranslation } from 'react-i18next'
import { useEditorStore } from '@/stores/editorStore'
import { formatFileSize } from '@/lib/fileStats'

function StatusSeparator(): React.ReactElement {
  return <span className="text-zinc-700">·</span>
}

export function EditorStatusInfo(): React.ReactElement | null {
  const { t } = useTranslation('layout')
  const stats = useEditorStore((s) => s.stats)
  if (!stats) return null

  return (
    <div
      className="flex min-w-0 items-center gap-2 truncate text-xs text-zinc-500"
      title={stats.path}
    >
      {stats.showCursor && (
        <>
          <span className="font-mono text-zinc-400">
            {t('status.cursor', { line: stats.line, column: stats.column })}
          </span>
          <StatusSeparator />
        </>
      )}
      <span>{t('status.lines', { count: stats.lineCount })}</span>
      <StatusSeparator />
      <span>{stats.indent}</span>
      <StatusSeparator />
      <span>{stats.encoding}</span>
      <StatusSeparator />
      <span>{stats.eol}</span>
      <StatusSeparator />
      <span className="font-mono">{formatFileSize(stats.sizeBytes)}</span>
      <StatusSeparator />
      <span className="text-zinc-400">{stats.language}</span>
    </div>
  )
}
