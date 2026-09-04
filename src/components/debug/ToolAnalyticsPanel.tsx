import { useEffect } from 'react'
import { X, FolderOpen, BarChart3, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { AgentRunAnalytics, ToolCallAnalytics } from '@/types'
import { cn } from '@/lib/utils'

const ISSUE_LABELS: Record<string, string> = {
  invalid_arguments_json: 'Invalid JSON args',
  missing_required_argument: 'Missing required arg',
  unknown_tool: 'Unknown tool',
  tool_not_allowed_in_mode: 'Tool not allowed in mode',
  empty_path: 'Empty path',
  empty_query: 'Empty query',
  empty_command: 'Empty command',
  execution_error: 'Execution error',
  search_replace_not_found: 'search_replace: not found',
  search_replace_ambiguous: 'search_replace: ambiguous',
  search_replace_identical: 'search_replace: identical strings',
  terminal_blocked: 'Terminal command blocked',
  no_results: 'No search results'
}

function OutcomeBadge({ outcome }: { outcome: ToolCallAnalytics['outcome'] }): React.ReactElement {
  if (outcome === 'success') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> OK
      </span>
    )
  }
  if (outcome === 'invalid_args') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-400">
        <AlertTriangle className="h-3 w-3" /> Bad args
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-400">
      <XCircle className="h-3 w-3" /> Error
    </span>
  )
}

function RunCard({ run }: { run: AgentRunAnalytics }): React.ReactElement {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-zinc-200">
            {run.mode} · {run.model.split('/').pop()}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            {new Date(run.startedAt).toLocaleString()} · {run.status} · {run.iterations}/
            {run.maxIterations} steps
          </div>
        </div>
        <div className="text-right text-[10px] font-mono text-zinc-500">
          <div className="text-emerald-400">{run.summary.success} ok</div>
          <div className="text-red-400">{run.summary.errors} err</div>
          <div className="text-amber-400">{run.summary.invalidArgs} bad args</div>
        </div>
      </div>

      <p className="mb-2 line-clamp-2 text-[11px] text-zinc-400">{run.userMessagePreview}</p>

      {run.error && (
        <p className="mb-2 rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{run.error}</p>
      )}

      {Object.keys(run.summary.byTool).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {Object.entries(run.summary.byTool).map(([name, stats]) => (
            <span
              key={name}
              className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
            >
              {name}: {stats.success}/{stats.total}
            </span>
          ))}
        </div>
      )}

      {run.toolCalls.length > 0 && (
        <div className="space-y-1.5 border-t border-white/5 pt-2">
          {run.toolCalls.map((call) => (
            <div
              key={call.id}
              className="rounded border border-white/5 bg-black/20 px-2 py-1.5 text-[10px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-zinc-300">
                  #{call.iteration} {call.name}
                </span>
                <OutcomeBadge outcome={call.outcome} />
              </div>
              <div className="mt-0.5 text-zinc-600">{call.durationMs}ms</div>
              {call.issues.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {call.issues.map((issue) => (
                    <span
                      key={issue}
                      className={cn(
                        'rounded px-1 py-0.5',
                        issue === 'no_results'
                          ? 'bg-amber-500/10 text-amber-300'
                          : 'bg-red-500/10 text-red-300'
                      )}
                    >
                      {ISSUE_LABELS[issue] ?? issue}
                    </span>
                  ))}
                </div>
              )}
              {call.resultPreview && (
                <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap text-zinc-500">
                  {call.resultPreview}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ToolAnalyticsPanel(): React.ReactElement | null {
  const panelOpen = useAnalyticsStore((s) => s.panelOpen)
  const runs = useAnalyticsStore((s) => s.runs)
  const setPanelOpen = useAnalyticsStore((s) => s.setPanelOpen)
  const loadRuns = useAnalyticsStore((s) => s.loadRuns)

  useEffect(() => {
    if (panelOpen) {
      void loadRuns()
    }
  }, [panelOpen, loadRuns])

  if (!panelOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-white/10 bg-[#0d0d14] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-medium text-zinc-200">Tool Analytics</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void window.api.analytics.openLogs()}
            >
              <FolderOpen className="mr-1 h-3 w-3" />
              Open logs
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No agent runs yet. Analytics appear after each chat with tools.
            </p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <RunCard key={run.runId} run={run} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
