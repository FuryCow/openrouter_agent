import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { useChatStore } from '@/stores/chatStore'
import { useFileStore } from '@/stores/fileStore'
import { useToastStore } from '@/stores/toastStore'
import type { MemorySuggestEntry } from '@/types'

export function MemorySuggestDialog(): React.ReactElement {
  const { t } = useTranslation('chat')
  const { t: tc } = useTranslation('common')
  const pendingSuggest = useChatStore((s) => s.pendingMemorySuggest)
  const setPendingMemorySuggest = useChatStore((s) => s.setPendingMemorySuggest)
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const addToast = useToastStore((s) => s.addToast)

  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (pendingSuggest?.entries.length) {
      setSelected(new Set(pendingSuggest.entries.map((_, index) => index)))
    } else {
      setSelected(new Set())
    }
  }, [pendingSuggest?.id, pendingSuggest?.entries.length])

  const entries = pendingSuggest?.entries ?? []

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setPendingMemorySuggest(null)
    }
  }

  const toggleEntry = (index: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleSave = async (): Promise<void> => {
    if (!pendingSuggest || !workingDirectory || selected.size === 0) {
      setPendingMemorySuggest(null)
      return
    }

    try {
      for (const index of [...selected].sort()) {
        const entry = pendingSuggest.entries[index]
        if (!entry) continue
        await window.api.memory.remember(
          { content: entry.content, category: entry.category, source: 'agent' },
          workingDirectory
        )
      }
      addToast(tc('toast.savedToMemory', { count: selected.size }), 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('memorySuggest.saveFailed'), 'error')
    }

    setPendingMemorySuggest(null)
  }

  const categoryLabel = (category: MemorySuggestEntry['category']): string =>
    t(`memory.category.${category}`)

  return (
    <Dialog open={Boolean(pendingSuggest)} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('memorySuggest.title')}</DialogTitle>
        </DialogHeader>

        {pendingSuggest && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-zinc-400">{t('memorySuggest.description')}</p>

            <ul className="space-y-2">
              {entries.map((entry, index) => (
                <li key={`${index}-${entry.content.slice(0, 24)}`}>
                  <label className="flex cursor-pointer gap-3 rounded-md border border-white/10 bg-black/20 p-3 hover:bg-black/30">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(index)}
                      onChange={() => toggleEntry(index)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 inline-block rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-indigo-300">
                        {categoryLabel(entry.category)}
                      </span>
                      <span className="block text-sm text-zinc-200 whitespace-pre-wrap break-words">
                        {entry.content}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSave()} disabled={selected.size === 0}>
                {t('memorySuggest.saveSelected')}
              </Button>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                {tc('actions.dismiss')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
