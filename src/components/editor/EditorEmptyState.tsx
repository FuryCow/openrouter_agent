import { FolderOpen, FileSearch, FolderTree, Keyboard, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { EmptyStateShell } from '@/components/ui/EmptyStateShell'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useUiStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

function ShortcutHint({
  keys,
  label,
  onClick
}: {
  keys: string
  label: string
  onClick?: () => void
}): React.ReactElement {
  const content = (
    <>
      <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
        {keys}
      </kbd>
      <span className="text-xs text-zinc-400">{label}</span>
    </>
  )

  if (!onClick) {
    return <div className="flex items-center gap-2">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-indigo-500/20 hover:bg-indigo-500/[0.04]"
    >
      {content}
    </button>
  )
}

export function EditorEmptyState(): React.ReactElement {
  const { t } = useTranslation('layout')
  const { t: tCommon } = useTranslation('common')
  const { workingDirectory, openFolderPicker } = useWorkspace()
  const setQuickOpenOpen = useUiStore((s) => s.setQuickOpenOpen)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)

  if (!workingDirectory) {
    return (
      <EmptyStateShell
        icon={Sparkles}
        title={t('editor.empty.noProject.title')}
        description={t('editor.empty.noProject.description')}
      >
        <Button
          type="button"
          className="w-full gap-2"
          onClick={() => void openFolderPicker()}
        >
          <FolderOpen className="h-4 w-4" />
          {t('editor.empty.noProject.openFolder')}
        </Button>

        <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
          <ShortcutHint keys="Ctrl+L" label={t('editor.empty.noProject.settingsHint')} />
        </div>
      </EmptyStateShell>
    )
  }

  const workspaceName = workingDirectory.split(/[/\\]/).pop() || workingDirectory

  return (
    <EmptyStateShell
      icon={Sparkles}
      title={t('editor.empty.noFile.title')}
      description={t('editor.empty.noFile.description')}
    >
      <div className="space-y-2">
        <ShortcutHint
          keys="Ctrl+P"
          label={t('editor.empty.quickOpen')}
          onClick={() => setQuickOpenOpen(true)}
        />
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <FolderTree className="h-4 w-4 shrink-0 text-sky-400/80" />
          <span className="text-xs text-zinc-400">{t('editor.empty.pickFromExplorer')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <FileSearch className="h-4 w-4 shrink-0 text-violet-400/80" />
          <span className="text-xs text-zinc-400">{t('editor.empty.clickPathHint')}</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
          {tCommon('labels.workspace')}
        </div>
        <div className="mt-1 truncate text-sm font-medium text-zinc-200">{workspaceName}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-600">{workingDirectory}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-500',
            'transition-colors hover:bg-white/[0.04] hover:text-zinc-300'
          )}
        >
          <Keyboard className="h-3.5 w-3.5" />
          {t('editor.empty.allShortcuts')}
          <kbd className="rounded border border-white/10 bg-black/30 px-1 font-mono text-[10px]">Ctrl+/</kbd>
        </button>
        <div className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-zinc-600">
          <kbd className="rounded border border-white/10 bg-black/30 px-1 font-mono text-[10px]">Ctrl+S</kbd>
          {t('editor.empty.save')}
        </div>
      </div>
    </EmptyStateShell>
  )
}
