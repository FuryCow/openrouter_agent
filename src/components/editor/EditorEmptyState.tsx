import { FolderOpen, FileSearch, FolderTree, Keyboard, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

function EmptyStateShell({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0f]/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] backdrop-blur-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20">
            <Sparkles className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <h2 className="text-base font-medium text-zinc-100">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}

export function EditorEmptyState(): React.ReactElement {
  const { workingDirectory, openFolderPicker } = useWorkspace()
  const setQuickOpenOpen = useUiStore((s) => s.setQuickOpenOpen)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)

  if (!workingDirectory) {
    return (
      <EmptyStateShell
        title="Откройте проект"
        description="Редактор и агент работают с файлами внутри workspace. Сначала выберите папку проекта."
      >
        <Button
          type="button"
          className="w-full gap-2"
          onClick={() => void openFolderPicker()}
        >
          <FolderOpen className="h-4 w-4" />
          Открыть папку
        </Button>

        <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
          <ShortcutHint keys="Ctrl+L" label="Настройки и API-ключ" />
        </div>
      </EmptyStateShell>
    )
  }

  const workspaceName = workingDirectory.split(/[/\\]/).pop() || workingDirectory

  return (
    <EmptyStateShell
      title="Файл не выбран"
      description="Откройте файл из дерева слева или через быстрый поиск. Пути из чата тоже кликабельны."
    >
      <div className="space-y-2">
        <ShortcutHint
          keys="Ctrl+P"
          label="Быстро открыть файл"
          onClick={() => setQuickOpenOpen(true)}
        />
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <FolderTree className="h-4 w-4 shrink-0 text-sky-400/80" />
          <span className="text-xs text-zinc-400">Выберите файл в Explorer слева</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <FileSearch className="h-4 w-4 shrink-0 text-violet-400/80" />
          <span className="text-xs text-zinc-400">Клик по пути в diff или tool call откроет файл здесь</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Workspace</div>
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
          Все shortcuts
          <kbd className="rounded border border-white/10 bg-black/30 px-1 font-mono text-[10px]">Ctrl+/</kbd>
        </button>
        <div className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-zinc-600">
          <kbd className="rounded border border-white/10 bg-black/30 px-1 font-mono text-[10px]">Ctrl+S</kbd>
          сохранить
        </div>
      </div>
    </EmptyStateShell>
  )
}
