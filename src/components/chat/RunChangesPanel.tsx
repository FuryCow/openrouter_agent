import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, X } from 'lucide-react'
import { FileIcon } from '../ui/FileIcon'
import { useAgentRunStore } from '@/stores/agentRunStore'
import { useFileStore } from '@/stores/fileStore'
import { useChatStore } from '@/stores/chatStore'
import { useToastStore } from '@/stores/toastStore'
import { openFileWithRunDiff } from '@/lib/openFileInEditor'
import { cn, getFileName, getRelativePath } from '@/lib/utils'
import type { RunCheckpointFileDetail } from '@/types'

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

export function RunChangesPanel(): React.ReactElement | null {
  const { t } = useTranslation('chat')
  const { t: tc } = useTranslation('common')
  const checkpoint = useAgentRunStore((s) => s.checkpoint)
  const changesPanelDismissed = useAgentRunStore((s) => s.changesPanelDismissed)
  const dismissChangesPanel = useAgentRunStore((s) => s.dismissChangesPanel)
  const showChangesPanel = useAgentRunStore((s) => s.showChangesPanel)
  const clearCheckpoint = useAgentRunStore((s) => s.clearCheckpoint)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fileDetails, setFileDetails] = useState<RunCheckpointFileDetail[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)

  useEffect(() => {
    if (!checkpoint || checkpoint.count === 0) {
      setFileDetails([])
      return
    }

    let cancelled = false
    void window.api.agent.getRunCheckpointDetails().then((details) => {
      if (!cancelled && details) {
        setFileDetails(details)
      }
    })

    return () => {
      cancelled = true
    }
  }, [checkpoint])

  if (!checkpoint || checkpoint.count === 0) return null

  const detailByPath = new Map(fileDetails.map((detail) => [normalizePath(detail.path), detail]))

  const handleRevertAll = async (): Promise<void> => {
    if (isStreaming || busy) return
    setBusy(true)
    try {
      const result = await window.api.agent.restoreRunCheckpoint()
      if (!result) {
        useToastStore.getState().addToast(t('toast.nothingToRevert'), 'info')
        return
      }
      await useFileStore.getState().reloadCleanTabsFromDisk()
      clearCheckpoint()
      setExpanded(false)
      setFileDetails([])
      setActivePath(null)
      useToastStore.getState().addToast(
        t('toast.revertedFiles', { count: result.restored + result.deleted }),
        'success'
      )
    } catch (err) {
      useToastStore.getState().addToast(
        err instanceof Error ? err.message : t('toast.revertFailed'),
        'error'
      )
    } finally {
      setBusy(false)
    }
  }

  const openFileDiff = async (path: string): Promise<void> => {
    const detail = detailByPath.get(normalizePath(path))
    setActivePath(path)
    if (detail) {
      await openFileWithRunDiff(path, detail)
      return
    }
    await openFileWithRunDiff(path, {
      fileDiff: { lines: [], scrollToLine: 1, highlightRanges: [] },
      inlineRanges: []
    })
  }

  const handleReview = async (): Promise<void> => {
    setExpanded(true)
    const ordered =
      fileDetails.length > 0
        ? fileDetails
        : checkpoint.paths.map((path) => ({
            path,
            additions: 0,
            deletions: 0,
            fileDiff: { lines: [], scrollToLine: 1, highlightRanges: [] },
            inlineRanges: []
          }))

    for (const detail of ordered) {
      await openFileWithRunDiff(detail.path, detail)
    }
    if (ordered[0]) {
      setActivePath(ordered[0].path)
    }
  }

  if (changesPanelDismissed) {
    return (
      <div className="flex h-7 items-center border-b border-white/5 px-2">
        <button
          type="button"
          onClick={showChangesPanel}
          className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          {t('runChanges.fileCount', { count: checkpoint.count })}
          <span className="mx-1.5 text-zinc-700">·</span>
          {t('runChanges.review')}
        </button>
      </div>
    )
  }

  return (
    <div className="border-b border-white/5">
      <div className="flex h-7 items-center gap-1.5 px-2">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex min-w-0 items-center gap-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200"
          aria-expanded={expanded}
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 text-zinc-500 transition-transform duration-150',
              expanded && 'rotate-90'
            )}
          />
          <span className="truncate">{t('runChanges.fileCount', { count: checkpoint.count })}</span>
        </button>

        <div className="min-w-0 flex-1" />

        <button
          type="button"
          onClick={() => void handleRevertAll()}
          disabled={isStreaming || busy}
          className="shrink-0 px-1.5 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-40"
        >
          {t('runChanges.undoAll')}
        </button>
        <button
          type="button"
          onClick={() => void handleReview()}
          disabled={isStreaming || busy}
          className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-white/10 hover:text-zinc-100 disabled:opacity-40"
        >
          {t('runChanges.review')}
        </button>
        <button
          type="button"
          onClick={dismissChangesPanel}
          disabled={isStreaming}
          className="shrink-0 rounded p-0.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
          title={tc('actions.close')}
          aria-label={tc('actions.close')}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <ul className="max-h-36 space-y-px overflow-y-auto px-1.5 pb-1.5">
              {(fileDetails.length > 0 ? fileDetails : checkpoint.paths.map((path) => ({ path, additions: 0, deletions: 0 }))).map(
                (entry) => {
                  const path = entry.path
                  const label = workingDirectory
                    ? getRelativePath(workingDirectory, path)
                    : getFileName(path)
                  const selected = activePath !== null && normalizePath(activePath) === normalizePath(path)
                  return (
                    <li key={path}>
                      <button
                        type="button"
                        onClick={() => void openFileDiff(path)}
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors',
                          selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                        )}
                        title={path}
                      >
                        <FileIcon name={getFileName(path)} className="h-3.5 w-3.5 shrink-0 opacity-80" />
                        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400">
                          {label}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] tabular-nums">
                          {entry.additions > 0 && (
                            <span className="text-emerald-400/90">+{entry.additions}</span>
                          )}
                          {entry.deletions > 0 && (
                            <span className="text-red-400/90">-{entry.deletions}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                }
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
