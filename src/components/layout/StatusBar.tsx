import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { EditorStatusInfo } from './EditorStatusInfo'
import { Terminal as TerminalIcon, BarChart3, Database, Plug } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { useIndexStore } from '@/stores/indexStore'
import { useMcp } from '@/hooks/useMcp'
import { getModelPriceLabel } from '@/lib/models'
import { cn } from '@/lib/utils'
import type { IndexStatus } from '@/types'

const INDEX_PHASE_CODE_TO_KEY: Record<string, string> = {
  'index.scanning': 'scanning',
  'index.indexingFiles': 'indexingFiles',
  'index.embedding': 'embedding'
}

function resolveIndexPhaseLabel(
  progress: NonNullable<IndexStatus['progress']>,
  tTools: TFunction<'tools'>
): string | null {
  const key = progress.phaseCode ? INDEX_PHASE_CODE_TO_KEY[progress.phaseCode] : null
  if (!key) return null
  return tTools(`index.${key}`)
}

function formatMcpLabel(
  status: ReturnType<typeof useMcp>['status'],
  t: TFunction<'layout'>
): string {
  if (status.enabledCount === 0) return t('status.mcp.none')
  return t('status.mcp.summary', {
    connected: status.connectedCount,
    enabled: status.enabledCount,
    tools: status.totalTools
  })
}

function mcpStatusColor(status: ReturnType<typeof useMcp>['status']): string {
  if (status.enabledCount === 0) return 'text-zinc-500'
  if (status.connectedCount === status.enabledCount) return 'text-emerald-400/80'
  if (status.connectedCount > 0) return 'text-amber-400'
  return 'text-red-400'
}

function formatIndexLabel(
  status: ReturnType<typeof useIndexStore.getState>['status'],
  t: TFunction<'layout'>,
  tTools: TFunction<'tools'>
): string {
  if (!status.workspacePath) return t('status.index.idle')
  if (status.state === 'building' && status.progress) {
    const phaseLabel = resolveIndexPhaseLabel(status.progress, tTools)
    const pct =
      status.progress.filesTotal > 0
        ? Math.round((status.progress.filesDone / status.progress.filesTotal) * 100)
        : 0
    if (phaseLabel) return `${phaseLabel} ${pct}%`
    return t('status.index.building', { percent: pct })
  }
  if (status.state === 'error') return t('status.index.error')
  if (status.state === 'ready') {
    return t('status.index.ready', { count: status.filesIndexed })
  }
  return t('status.index.pending')
}

export function StatusBar(): React.ReactElement {
  const { t } = useTranslation('layout')
  const { t: tTools } = useTranslation('tools')
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

  const indexLabel = formatIndexLabel(indexStatus, t, tTools)
  const mcpLabel = formatMcpLabel(mcpStatus, t)
  const mcpTooltip =
    mcpStatus.servers.length === 0
      ? t('status.mcp.configure')
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
                ? t('status.index.lastBuilt', { date: indexStatus.lastBuiltAt })
                : t('status.index.rebuildTooltip')
          }
        >
          <Database className="h-3.5 w-3.5" />
          {indexLabel}
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsOpen(true)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-white/5 hover:text-zinc-300"
          title={t('status.toolsTooltip')}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {t('status.tools')}
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
          title={t('status.terminalTooltip')}
        >
          <TerminalIcon className="h-3.5 w-3.5" />
          {t('status.terminal')}
        </button>
      </div>

      <div className="hidden min-w-0 flex-1 justify-center px-4 lg:flex">
        <EditorStatusInfo />
      </div>

      <div className="flex shrink-0 items-center gap-3 text-sm">
        <span>{settings.apiKey ? t('status.apiConnected') : t('status.noApiKey')}</span>
        <span className="text-zinc-600">{t('status.modelCount', { count: modelCount })}</span>
        <span className="font-medium text-indigo-400">{settings.model.split('/').pop()}</span>
        {currentModel && (
          <span className="font-mono text-emerald-500/80">{getModelPriceLabel(currentModel)}</span>
        )}
      </div>
    </div>
  )
}
