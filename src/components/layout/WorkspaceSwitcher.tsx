import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import { Check, FolderOpen, History } from 'lucide-react'
import { useWorkspace } from '@/hooks/useWorkspace'
import { cn } from '@/lib/utils'

function workspaceName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() ?? path
}

export function WorkspaceSwitcher(): React.ReactElement {
  const { t } = useTranslation('layout')
  const [open, setOpen] = useState(false)
  const { workingDirectory, recentWorkspaces, openFolderPicker, openWorkspace } = useWorkspace()

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex max-w-md items-center gap-1.5 truncate rounded px-1.5 py-0.5 transition-colors hover:bg-white/5 hover:text-zinc-300',
            open && 'bg-white/5 text-zinc-300'
          )}
          title={workingDirectory || t('workspace.openProjectTitle')}
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{workingDirectory || t('workspace.noFolder')}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          side="top"
          sideOffset={8}
          className="z-50 w-80 rounded-xl border border-white/10 bg-surface p-2 shadow-2xl backdrop-blur-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void openFolderPicker()
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5"
          >
            <FolderOpen className="h-3.5 w-3.5 text-indigo-400" />
            {t('workspace.openAnother')}
          </button>

          {workingDirectory && (
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">{workspaceName(workingDirectory)}</div>
                <div className="truncate text-[10px] text-indigo-200/70">{workingDirectory}</div>
              </div>
            </div>
          )}

          {recentWorkspaces.length > 0 && (
            <div className="mt-2 border-t border-white/5 pt-2">
              <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                <History className="h-3 w-3" />
                {t('workspace.recent')}
              </div>
              <div className="max-h-48 overflow-y-auto">
                {recentWorkspaces.map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      void openWorkspace(path)
                    }}
                    className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-white/5"
                  >
                    <span className="text-xs text-zinc-300">{workspaceName(path)}</span>
                    <span className="truncate text-[10px] text-zinc-600">{path}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
