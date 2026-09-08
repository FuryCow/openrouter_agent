import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getKeyboardShortcuts } from '@/lib/shortcuts'
import { useUiStore } from '@/stores/uiStore'

export function ShortcutsModal(): React.ReactElement {
  const { t } = useTranslation('layout')
  const open = useUiStore((s) => s.shortcutsOpen)
  const setOpen = useUiStore((s) => s.setShortcutsOpen)
  const shortcuts = getKeyboardShortcuts(t)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('shortcuts.title')}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <span className="text-sm text-zinc-300">{shortcut.description}</span>
              <kbd className="shrink-0 rounded-md border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
