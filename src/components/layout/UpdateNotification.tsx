import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, X } from 'lucide-react'
import { Button } from '../ui/button'
import type { UpdateInfo } from '@/types'

/**
 * Bottom-left card announcing a newer GitHub release.
 * Shown when the main process reports an update; "Skip" stores the version
 * in settings so the same release does not nag again.
 */
export function UpdateNotification(): React.ReactElement | null {
  const { t } = useTranslation('layout')
  const [update, setUpdate] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    const api = window.api?.updates
    if (!api) return

    void api.getCached?.().then((value: UpdateInfo | null) => {
      if (!cancelled && value) setUpdate(value)
    })
    const unsubscribe = api.onAvailable?.((value: UpdateInfo) => setUpdate(value))

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const handleDismiss = (): void => {
    if (update) void window.api?.updates?.dismiss?.(update.version)
    setUpdate(null)
  }

  const handleOpenRelease = (): void => {
    if (update) void window.api?.shell?.openExternal?.(update.releaseUrl)
  }

  return (
    <AnimatePresence>
      {update && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-10 left-4 z-[90] w-80 overflow-hidden rounded-xl border border-indigo-500/20 bg-surface-elevated/95 shadow-2xl backdrop-blur-xl"
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
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/5 px-4 py-2.5">
            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={handleDismiss}>
              {t('updates.dismiss')}
            </Button>
            <Button size="sm" className="h-7 gap-1.5 px-3 text-xs" onClick={handleOpenRelease}>
              <Rocket className="h-3 w-3" />
              {t('updates.whatsNew')}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}