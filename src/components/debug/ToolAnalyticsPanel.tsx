import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, FolderOpen, BarChart3, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import type { AgentRunAnalytics, ToolCallAnalytics } from '@/types'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/i18n/t'

const ISSUE_KEYS: Record<string, string> = {
  invalid_arguments_json: 'issues.invalidArgumentsJson',
  missing_required_argument: 'issues.missingRequiredArgument',
  unknown_tool: 'issues.unknownTool',
  tool_not_allowed_in_mode: 'issues.toolNotAllowedInMode',
  empty_path: 'issues.emptyPath',
  empty_query: 'issues.emptyQuery',
  empty_command: 'issues.emptyCommand',
  execution_error: 'issues.executionError',
  search_replace_not_found: 'issues.searchReplaceNotFound',
  search_replace_ambiguous: 'issues.searchReplaceAmbiguous',
  search_replace_identical: 'issues.searchReplaceIdentical',
  terminal_blocked: 'issues.terminalBlocked',
  no_results: 'issues.noResults'
}

function OutcomeBadge({ outcome }: { outcome: ToolCallAnalytics['outcome'] }): React.ReactElement {
  const { t: tc } = useTranslation('common')
  if (outcome === 'success') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> {tc('status.ok')}
      </span>
    )
  }
  if (outcome === 'invalid_args') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-400">
        <AlertTriangle className="h-3 w-3" /> {tc('status.badArgs')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-400">
      <XCircle className="h-3 w-3" /> {tc('status.error')}
    </span>
  )
}

function RunCard({ run }: { run: AgentRunAnalytics }): React.ReactElement {
  const { t } = useTranslation('tools')
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-zinc-200">
            {t('analytics.runMeta', { mode: run.mode, model: run.model.split('/').pop() ?? run.model })}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            {t('analytics.runStats', {
              date: formatDateTime(run.startedAt),
              status: run.status,
              iterations: run.iterations,
              max: run.maxIterations
            })}
          </div>
        </div>
        <div className="text-right text-[10px] font-mono text-zinc-500">
          <div className="text-emerald-400">{t('analytics.successCount', { count: run.summary.success })}</div>
          <div className="text-red-400">{t('analytics.errorCount', { count: run.summary.errors })}</div>
          <div className="text-amber-400">
            {t('analytics.badArgsCount', { count: run.summary.invalidArgs })}
          </div>
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
              {t('analytics.toolStats', { name, success: stats.success, total: stats.total })}
            </span>
          ))}
        </div>
      )}

      {run.toolCalls.length > 0 && (
        <div className="space-y-1.5 border-t border-white/5 pt-2">
          {run.toolCalls.map((call) => (
            <ToolCallRow key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolCallRow({ call }: { call: ToolCallAnalytics }): React.ReactElement {
  const { t } = useTranslation('tools')
  return (
    <div className="rounded border border-white/5 bg-black/20 px-2 py-1.5 text-[10px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-zinc-300">
          {t('analytics.iteration', { n: call.iteration, name: call.name })}
        </span>
        <OutcomeBadge outcome={call.outcome} />
      </div>
      <div className="mt-0.5 text-zinc-600">{t('analytics.duration', { ms: call.durationMs })}</div>
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
              {ISSUE_KEYS[issue] ? t(ISSUE_KEYS[issue]) : issue}
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
  )
}

export function ToolAnalyticsPanel(): React.ReactElement | null {
  const { t } = useTranslation('tools')
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
            <h2 className="text-sm font-medium text-zinc-200">{t('analytics.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void window.api.analytics.openLogs()}
            >
              <FolderOpen className="mr-1 h-3 w-3" />
              {t('analytics.openLogs')}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t('analytics.empty')}</p>
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
