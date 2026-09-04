import { FolderOpen, Terminal as TerminalIcon, BarChart3 } from 'lucide-react'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { getModelPriceLabel } from '@/lib/models'
import { cn } from '@/lib/utils'

export function StatusBar(): React.ReactElement {
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const settings = useSettingsStore((s) => s.settings)
  const modelCount = useSettingsStore((s) => s.models.length)
  const currentModel = useSettingsStore((s) => s.models.find((m) => m.id === s.settings.model))
  const terminalOpen = useSettingsStore((s) => s.terminalOpen)
  const setTerminalOpen = useSettingsStore((s) => s.setTerminalOpen)
  const setAnalyticsOpen = useAnalyticsStore((s) => s.setPanelOpen)
  const lastRun = useAnalyticsStore((s) => s.runs[0])

  return (
    <div className="flex h-6 items-center justify-between border-t border-white/5 bg-[#0a0a0f] px-3 text-[10px] text-zinc-500">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-3 w-3" />
          <span className="truncate max-w-md">
            {workingDirectory || 'No folder open'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAnalyticsOpen(true)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-white/5 hover:text-zinc-300"
          title="Tool call analytics"
        >
          <BarChart3 className="h-3 w-3" />
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
          <TerminalIcon className="h-3 w-3" />
          Terminal
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span>{settings.apiKey ? 'API connected' : 'No API key'}</span>
        <span className="text-zinc-600">{modelCount} models</span>
        <span className="text-indigo-400">{settings.model.split('/').pop()}</span>
        {currentModel && (
          <span className="font-mono text-emerald-500/70">{getModelPriceLabel(currentModel)}</span>
        )}
      </div>
    </div>
  )
}
