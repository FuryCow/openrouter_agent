import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  ListPlus,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
  XCircle
} from 'lucide-react'
import { Button } from '../ui/button'
import { useRunQueueStore } from '@/stores/runQueueStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFileStore } from '@/stores/fileStore'
import { useToastStore } from '@/stores/toastStore'
import { openFileWithRunDiff } from '@/lib/openFileInEditor'
import { cn } from '@/lib/utils'
import type { QueuedRun, QueuedRunStatus } from '@/types'

function StatusIcon({ status }: { status: QueuedRunStatus }): React.ReactElement {
  const className = 'h-4 w-4 shrink-0'
  switch (status) {
    case 'queued':
      return <Clock className={cn(className, 'text-zinc-500')} />
    case 'running':
      return <Loader2 className={cn(className, 'animate-spin text-indigo-400')} />
    case 'awaiting_approval':
      return <CircleDot className={cn(className, 'text-amber-400')} />
    case 'completed':
      return <CheckCircle2 className={cn(className, 'text-emerald-400')} />
    case 'error':
    case 'aborted':
    case 'max_iterations':
    case 'cancelled':
    case 'interrupted':
      return <XCircle className={cn(className, 'text-red-400/90')} />
    default:
      return <Circle className={cn(className, 'text-zinc-600')} />
  }
}

function TaskRow({ task }: { task: QueuedRun }): React.ReactElement {
  const { t } = useTranslation('chat')
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const active =
    task.status === 'queued' || task.status === 'running' || task.status === 'awaiting_approval'

  const cancel = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await window.api.queue.cancel(task.id)
    } catch (err) {
      useToastStore
        .getState()
        .addToast(err instanceof Error ? err.message : t('runQueue.cancelFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const approve = async (approved: boolean): Promise<void> => {
    if (busy || !task.approval) return
    setBusy(true)
    try {
      await window.api.queue.approve(task.id, task.approval.id, approved)
    } catch (err) {
      useToastStore
        .getState()
        .addToast(err instanceof Error ? err.message : t('runQueue.approveFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const openDiff = async (): Promise<void> => {
    if (!task.checkpoint || task.checkpoint.paths.length === 0) return
    try {
      const details = await window.api.queue.getCheckpointDetails(task.id)
      const first = details?.[0]
      if (first) {
        await openFileWithRunDiff(first.path, first)
      } else {
        await openFileWithRunDiff(task.checkpoint.paths[0], {
          fileDiff: { lines: [], scrollToLine: 1, highlightRanges: [] },
          inlineRanges: []
        })
      }
    } catch (err) {
      useToastStore
        .getState()
        .addToast(err instanceof Error ? err.message : t('runQueue.diffFailed'), 'error')
    }
  }

  const restore = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      const result = await window.api.queue.restoreRunCheckpoint(task.id)
      if (result) {
        await useFileStore.getState().reloadCleanTabsFromDisk()
        useToastStore
          .getState()
          .addToast(t('runQueue.restored', { count: result.restored + result.deleted }), 'success')
      }
    } catch (err) {
      useToastStore
        .getState()
        .addToast(err instanceof Error ? err.message : t('runQueue.restoreFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-lg border border-white/5 bg-white/[0.03]">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform duration-150',
              expanded && 'rotate-90'
            )}
          />
          <StatusIcon status={task.status} />
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">{task.title}</span>
          {task.checklist && task.checklist.length > 0 && (
            <span className="shrink-0 font-mono text-[11px] text-zinc-500">
              {task.checklist.filter((s) => s.status === 'done').length}/{task.checklist.length}
            </span>
          )}
          {task.checkpoint && task.checkpoint.count > 0 && (
            <span className="shrink-0 font-mono text-[11px] text-zinc-500">
              {t('runChanges.fileCount', { count: task.checkpoint.count })}
            </span>
          )}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={busy}
            className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400 disabled:opacity-40"
            title={t('runQueue.cancel')}
            aria-label={t('runQueue.cancel')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
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
            <div className="space-y-2 border-t border-white/5 px-2.5 py-2.5">
              {task.error && <p className="text-[11px] text-red-400/90">{task.error}</p>}
              {task.tail && (
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md bg-black/20 p-2 font-mono text-[11px] text-zinc-400">
                  {task.tail}
                </pre>
              )}
              {task.approval && (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-amber-300/90">
                    {task.approval.name}
                    {task.approval.preview ? ` · ${task.approval.preview}` : ''}
                  </span>
                  <Button
                    variant="secondary"
                    className="h-7 px-2.5 text-[11px]"
                    onClick={() => void approve(true)}
                    disabled={busy}
                  >
                    {t('runQueue.approve')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7 px-2.5 text-[11px]"
                    onClick={() => void approve(false)}
                    disabled={busy}
                  >
                    {t('runQueue.deny')}
                  </Button>
                </div>
              )}
              {task.checkpoint && task.checkpoint.count > 0 && (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void openDiff()}
                    className="text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
                  >
                    {t('runChanges.review')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void restore()}
                    disabled={busy}
                    className="text-[11px] text-amber-300/90 underline-offset-2 hover:text-amber-200 hover:underline disabled:opacity-40"
                  >
                    {t('runQueue.restore')}
                  </button>
                </div>
              )}
              {task.dependsOn.length > 0 && (
                <p className="font-mono text-[11px] text-zinc-600">
                  dependsOn: {task.dependsOn.join(', ')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export function RunQueuePanel(): React.ReactElement | null {
  const { t } = useTranslation('chat')
  const tasks = useRunQueueStore((s) => s.tasks)
  const paused = useRunQueueStore((s) => s.paused)
  const pausedReason = useRunQueueStore((s) => s.pausedReason)
  const drainedSummary = useRunQueueStore((s) => s.drainedSummary)
  const runQueueEnabled = useSettingsStore((s) => s.settings.runQueueEnabled === true)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)

  if (!runQueueEnabled && tasks.length === 0) return null

  const enqueue = async (): Promise<void> => {
    if (busy || !title.trim() || !prompt.trim()) return
    setBusy(true)
    try {
      await window.api.queue.enqueue({ title: title.trim(), prompt: prompt.trim(), source: 'user' })
      setTitle('')
      setPrompt('')
      setAdding(false)
    } catch (err) {
      useToastStore
        .getState()
        .addToast(err instanceof Error ? err.message : t('runQueue.enqueueFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const clearFinished = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await window.api.queue.clearFinished()
    } catch (err) {
      useToastStore
        .getState()
        .addToast(err instanceof Error ? err.message : t('runQueue.clearFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const togglePaused = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await window.api.queue.setPaused(!paused)
    } catch (err) {
      useToastStore
        .getState()
        .addToast(err instanceof Error ? err.message : t('runQueue.pauseFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const hasFinished = tasks.some(
    (task) =>
      task.status !== 'queued' && task.status !== 'running' && task.status !== 'awaiting_approval'
  )

  return (
    <div className="border-b border-white/5">
      <div className="flex h-9 items-center gap-2 px-2.5">
        <ListPlus className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="text-xs text-zinc-300">{t('runQueue.title')}</span>
        <span className="font-mono text-[11px] text-zinc-600">
          {tasks.filter((task) => task.status === 'queued').length}
        </span>
        {paused && (
          <span className="text-[11px] text-amber-400/90">
            {pausedReason === 'foreground'
              ? t('runQueue.pausedForeground')
              : t('runQueue.pausedUser')}
          </span>
        )}
        <div className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={() => void togglePaused()}
          disabled={busy}
          className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400 disabled:opacity-40"
          title={paused ? t('runQueue.resume') : t('runQueue.pause')}
          aria-label={paused ? t('runQueue.resume') : t('runQueue.pause')}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => setAdding((open) => !open)}
          className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
          title={t('runQueue.add')}
          aria-label={t('runQueue.add')}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {hasFinished && (
          <button
            type="button"
            onClick={() => void clearFinished()}
            disabled={busy}
            className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400 disabled:opacity-40"
            title={t('runQueue.clearFinished')}
            aria-label={t('runQueue.clearFinished')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {drainedSummary && (
        <div className="px-2.5 pb-2 text-[11px] text-zinc-500">
          {t('runQueue.drainedSummary', {
            total: drainedSummary.total,
            completed: drainedSummary.completed,
            error: drainedSummary.error,
            awaitingApproval: drainedSummary.awaitingApproval
          })}
        </div>
      )}

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-2.5 pb-2.5">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('runQueue.titlePlaceholder')}
                maxLength={120}
                className="input-field h-9 text-xs"
              />
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('runQueue.promptPlaceholder')}
                maxLength={8000}
                rows={4}
                className="input-field resize-none text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setAdding(false)}
                >
                  {t('runQueue.cancelAdd')}
                </Button>
                <Button
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => void enqueue()}
                  disabled={busy || !title.trim() || !prompt.trim()}
                >
                  {t('runQueue.addConfirm')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tasks.length > 0 && (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto px-2 pb-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </div>
  )
}
