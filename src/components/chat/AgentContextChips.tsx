import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pin, X } from 'lucide-react'
import { useFileStore } from '@/stores/fileStore'
import { useAgentContextStore } from '@/stores/agentContextStore'
import { buildAgentContextFiles } from '@/lib/agentContext'
import { getRelativePath, isImagePath, cn } from '@/lib/utils'

export function AgentContextChips(): React.ReactElement | null {
  const { t } = useTranslation('chat')
  const tabs = useFileStore((s) => s.tabs)
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const activeTabPath = useFileStore((s) => s.activeTabPath)
  const pinnedPaths = useAgentContextStore((s) => s.pinnedPaths)
  const excludedPaths = useAgentContextStore((s) => s.excludedPaths)
  const excludePath = useAgentContextStore((s) => s.excludePath)
  const unpinPath = useAgentContextStore((s) => s.unpinPath)

  const contextFiles = useMemo(() => {
    const codeTabs = tabs.filter((tab) => !isImagePath(tab.path))
    return buildAgentContextFiles(codeTabs, {
      pinnedPaths,
      excludedPaths,
      activeTabPath
    })
  }, [tabs, pinnedPaths, excludedPaths, activeTabPath])

  if (contextFiles.length === 0) return null

  return (
    <div className="border-b border-white/5 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {t('agentContext.title')}
        </span>
        <span className="text-[10px] text-zinc-600">
          {t('agentContext.count', { count: contextFiles.length })}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {contextFiles.map((file) => {
          const label = workingDirectory
            ? getRelativePath(workingDirectory, file.path)
            : file.path
          return (
            <span
              key={file.path}
              className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]',
                file.pinned
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
                  : 'border-white/10 bg-white/[0.03] text-zinc-400'
              )}
              title={
                file.truncated
                  ? t('agentContext.truncatedTooltip', { path: file.path })
                  : file.path
              }
            >
              {file.pinned && <Pin className="h-2.5 w-2.5 shrink-0 text-indigo-300" />}
              <span className="truncate">{label}</span>
              {file.truncated && (
                <span className="shrink-0 text-zinc-600">{t('agentContext.truncated')}</span>
              )}
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                onClick={() => {
                  excludePath(file.path)
                  if (file.pinned) unpinPath(file.path)
                }}
                aria-label={t('agentContext.remove', { path: label })}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
