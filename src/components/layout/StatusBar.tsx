import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { EditorStatusInfo } from './EditorStatusInfo'
import { Terminal as TerminalIcon, BarChart3, Database, Plug } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { useIndexStore } from '@/stores/indexStore'
import { useMcp } from '@/hooks/useMcp'
import { getModelPriceLabel } from '@/lib/models'
import { cn } from '@/lib/utils'

function formatMcpLabel(status: ReturnType<typeof useMcp>['status']): string {
  if (status.enabledCount === 0) return 'MCP · none'
  return `MCP · ${status.connectedCount}/${status.enabledCount} · ${status.totalTools} tools`
}

function mcpStatusColor(status: ReturnType<typeof useMcp>['status']): string {
  if (status.enabledCount === 0) return 'text-zinc-500'
  if (status.connectedCount === status.enabledCount) return 'text-emerald-400/80'
  if (status.connectedCount > 0) return 'text-amber-400'
  return 'text-red-400'
}
function formatIndexLabel(status: ReturnType<typeof useIndexStore.getState>['status']): string {
  if (!status.workspacePath) return 'Index idle'
  if (status.state === 'building' && status.progress) {
    const pct =
      status.progress.filesTotal > 0
        ? Math.round((status.progress.filesDone / status.progress.filesTotal) * 100)
        : 0
    return `Indexing ${pct}%`
  }
  if (status.state === 'error') return 'Index error'
  if (status.state === 'ready') {
    return `Index ready · ${status.filesIndexed} files`
  }
  return 'Index…'
}

export function StatusBar(): React.ReactElement {
  const settings = useSettingsStore((s) => s.settings)
  const modelCount = useSettingsStore((s) => s.models.length)
  const currentModel = useSettingsStore((s) => s.models.find((m) => m.id === s.settings.model))
  const terminalOpen = useSettingsStore((s) => s.terminalOpen)
  const setTerminalOpen = useSettingsStore((s) => s.setTerminalOpen)
  const setAnalyticsOpen = useAnalyticsStore((s) => s.setPanelOpen)
  const lastRun = useAnalyticsStore((s) => s.runs[0])
  const indexStatus = useIndexStore((s) => s.status)
  const rebuildIndex = useIndexStore((s) => s.rebuild)
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen)
  const { status: mcpStatus } = useMcp()

  const indexLabel = formatIndexLabel(indexStatus)
  const mcpLabel = formatMcpLabel(mcpStatus)
  const mcpTooltip =
    mcpStatus.servers.length === 0
      ? 'Configure MCP servers'
      : mcpStatus.servers
          .map((s) => `${s.name}: ${s.status}${s.lastError ? ` — ${s.lastError}` : ''}`)
          .join('\n')

  return (
    <div className="flex h-8 items-center justify-between border-t border-white/5 bg-[#0a0a0f] px-3 text-xs text-zinc-500">
      <div className="flex items-center gap-3">
        <WorkspaceSwitcher />
        <button
          type="button"
          onClick={() => setSettingsOpen(true, 'mcp')}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-white/5 hover:text-zinc-300',
            mcpStatusColor(mcpStatus)
          )}
          title={mcpTooltip}
        >
          <Plug className="h-3.5 w-3.5" />
          {mcpLabel}
        </button>
        <button
          type="button"
          onClick={() => void rebuildIndex()}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-white/5 hover:text-zinc-300',
            indexStatus.state === 'building' && 'text-indigo-400',
            indexStatus.state === 'error' && 'text-red-400',
            indexStatus.state === 'ready' && 'text-emerald-400/80'
          )}
          title={
            indexStatus.error
              ? indexStatus.error
              : indexStatus.lastBuiltAt
                ? `Last built: ${indexStatus.lastBuiltAt}`
                : 'Rebuild codebase index'
          }
        >
          <Database className="h-3.5 w-3.5" />
          {indexLabel}
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsOpen(true)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-white/5 hover:text-zinc-300"
          title="Tool call analytics"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Tools
          {lastRun && (
            <span className="font-mono text-emerald-400/80">
              {lastRun.summary.success}/{lastRun.summary.totalTools}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTerminalOpen(!terminalOpen)}
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-white/5 hover:text-zinc-300',
            terminalOpen && 'bg-indigo-500/10 text-indigo-400'
          )}
          title="Toggle terminal (Ctrl+`)"
        >
          <TerminalIcon className="h-3.5 w-3.5" />
          Terminal
        </button>
      </div>

      <div className="hidden min-w-0 flex-1 justify-center px-4 lg:flex">
        <EditorStatusInfo />
      </div>

      <div className="flex shrink-0 items-center gap-3 text-sm">
        <span>{settings.apiKey ? 'API connected' : 'No API key'}</span>
        <span className="text-zinc-600">{modelCount} models</span>
        <span className="font-medium text-indigo-400">{settings.model.split('/').pop()}</span>
        {currentModel && (
          <span className="font-mono text-emerald-500/80">{getModelPriceLabel(currentModel)}</span>
        )}
      </div>
    </div>
  )
}
