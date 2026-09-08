import { useTranslation } from 'react-i18next'
import { openFileInEditor } from '@/lib/openFileInEditor'
import { cn } from '@/lib/utils'
import type { FileDiffPreview } from '@/types'

type FilePathLinkProps = {
  path: string
  className?: string
  fileDiff?: FileDiffPreview
}

export function FilePathLink({ path, className, fileDiff }: FilePathLinkProps): React.ReactElement {
  const { t } = useTranslation('chat')

  const handleOpen = async (event: React.MouseEvent | React.KeyboardEvent): Promise<void> => {
    event.preventDefault()
    event.stopPropagation()
    try {
      await openFileInEditor(path, {
        scrollToLine: fileDiff?.scrollToLine,
        highlightRanges: fileDiff?.highlightRanges
      })
    } catch {
      // File may be missing or outside workspace
    }
  }

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(event) => void handleOpen(event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') void handleOpen(event)
      }}
      className={cn(
        'font-mono text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer',
        className
      )}
      title={t('filePath.openInEditor')}
    >
      {path}
    </span>
  )
}
