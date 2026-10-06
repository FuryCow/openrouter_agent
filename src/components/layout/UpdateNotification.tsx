import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Loader2, Rocket, X } from 'lucide-react'
import { Button } from '../ui/button'
import { useToastStore } from '@/stores/toastStore'
import type { UpdateInfo, UpdateDownloadProgress } from '@/types'

/**
 * Bottom-left card announcing a newer GitHub release.
 * Shown when the main process reports an update; "Skip" stores the version
 * in settings so the same release does not nag again. "Install" downloads
 * the platform installer and launches it.
 */
export function UpdateNotification(): React.ReactElement | null {
  const { t } = useTranslation('layout')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<UpdateDownloadProgress | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    let cancelled = false
    const api = window.api?.updates
    if (!api) return

    void api.getCached?.().then((value: UpdateInfo | null) => {
      if (!cancelled && value) setUpdate(value)
    })
    const unsubscribe = api.onAvailable?.((value: UpdateInfo) => setUpdate(value))
    const unsubscribeProgress = api.onDownloadProgress?.((value: UpdateDownloadProgress) => {
      setProgress(value)
    })

    return () => {
      cancelled = true
      unsubscribe?.()
      unsubscribeProgress?.()
    }
  }, [])

  const handleDismiss = (): void => {
    if (update) void window.api?.updates?.dismiss?.(update.version)
    setUpdate(null)
  }

  const handleOpenRelease = (): void => {
    if (update) void window.api?.shell?.openExternal?.(update.releaseUrl)
  }

  const handleInstall = (): void => {
    if (!update || installing) return
    setInstalling(true)
    setProgress({ version: update.version, percent: 0, received: 0, total: 0 })
    void window.api?.updates
      ?.install?.(update)
      .then((result) => {
        if (result?.ok) {
          useToastStore
            .getState()
            .addToast(t('updates.installerLaunched', { version: update.version }), 'success')
          setUpdate(null)
        } else {
          useToastStore
            .getState()
            .addToast(t('updates.installFailed', { error: result?.error ?? 'unknown' }), 'error')
        }
      })
      .catch(() => {
        useToastStore.getState().addToast(t('updates.installFailed', { error: 'network' }), 'error')
      })
      .finally(() => {
        setInstalling(false)
        setProgress(null)
      })
  }

  const installLabel = installing
    ? progress && progress.total > 0
      ? t('updates.downloading', { percent: progress.percent })
      : t('updates.preparing')
    : t('updates.install')

  return (
    <AnimatePresence>
      {update && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-10 left-4 z-[90] w-96 overflow-hidden rounded-xl border border-indigo-500/20 bg-surface-elevated/95 shadow-2xl backdrop-blur-xl"
          role="status"
        >
          <div className="flex items-start gap-3 px-4 pt-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 ring-1 ring-inset ring-indigo-500/30">
              <Rocket className="h-4 w-4 text-indigo-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100">{t('updates.title')}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-indigo-300/90">
                {update.releaseName || update.version}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
              aria-label={t('updates.dismiss')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {update.releaseNotes?.trim() && (
            <p className="mt-2 line-clamp-2 px-4 text-xs leading-relaxed text-zinc-500">
              {update.releaseNotes.trim().split('\n')[0]}
            </p>
          )}
          {installing && progress && progress.total > 0 && (
            <div className="mt-2 px-4">
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-[width] duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/5 px-4 py-2.5">
            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={handleDismiss} disabled={installing}>
              {t('updates.dismiss')}
            </Button>
            <Button variant="secondary" size="sm" className="h-7 gap-1.5 px-3 text-xs" onClick={handleOpenRelease}>
              <Rocket className="h-3 w-3" />
              {t('updates.whatsNew')}
            </Button>
            <Button size="sm" className="h-7 gap-1.5 px-3 text-xs" onClick={handleInstall} disabled={installing}>
              {installing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              {installLabel}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}