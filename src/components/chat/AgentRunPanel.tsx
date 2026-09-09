import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { useAgentRunStore } from '@/stores/agentRunStore'
import { formatRunStatusLine } from '@/lib/agentRunUi'
import { cn } from '@/lib/utils'
import type { TaskChecklistStepState } from '@/types'

function ChecklistStepIcon({ status }: { status: TaskChecklistStepState['status'] }): React.ReactElement {
  if (status === 'done') {
    return <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
  }
  if (status === 'in_progress') {
    return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-indigo-400" />
  }
  return <Circle className="h-3 w-3 shrink-0 text-zinc-600" />
}

export function AgentRunPanel(): React.ReactElement | null {
  const { t } = useTranslation('chat')
  const chatMode = useChatStore((s) => s.chatMode)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const runStatus = useAgentRunStore((s) => s.runStatus)
  const checklist = useAgentRunStore((s) => s.checklist)
  const lastTerminalOutput = useAgentRunStore((s) => s.lastTerminalOutput)

  const statusLine = useMemo(
    () =>
      formatRunStatusLine(runStatus, checklist, {
        running: t('agentRun.status.running'),
        awaitingApproval: t('agentRun.status.awaitingApproval'),
        completed: t('agentRun.status.completed'),
        error: t('agentRun.status.error'),
        aborted: t('agentRun.status.aborted'),
        maxIterations: t('agentRun.status.maxIterations'),
        step: (current, total, text) => t('agentRun.status.step', { current, total, text })
      }),
    [runStatus, checklist, t]
  )

  const showChecklist = Boolean(checklist && checklist.length > 0)
  const showPanel =
    chatMode === 'agent' &&
    (isStreaming || showChecklist || statusLine || lastTerminalOutput)

  if (!showPanel) return null

  return (
    <div className="border-b border-white/5 bg-white/[0.02] px-3 py-2">
      {statusLine && (
        <div className="mb-2 flex items-center gap-2 text-xs text-zinc-300">
          {(runStatus === 'running' || runStatus === 'awaiting_approval') && (
            <Loader2
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                runStatus === 'awaiting_approval' ? 'text-amber-400' : 'animate-spin text-indigo-400'
              )}
            />
          )}
          <span>{statusLine}</span>
        </div>
      )}

      {showChecklist && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            {t('agentRun.checklistTitle')}
          </span>
          <ul className="space-y-0.5">
            {checklist!.map((step, index) => (
              <li
                key={`${index}-${step.text}`}
                className={cn(
                  'flex items-start gap-2 text-[11px] leading-snug',
                  step.status === 'done' && 'text-zinc-500 line-through',
                  step.status === 'in_progress' && 'text-zinc-200',
                  step.status === 'pending' && 'text-zinc-400'
                )}
              >
                <ChecklistStepIcon status={step.status} />
                <span className="min-w-0 flex-1">{step.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastTerminalOutput && (
        <div className="mt-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            {t('agentRun.terminalOutput')}
          </span>
          <pre className="mt-1 max-h-32 overflow-auto rounded-md border border-white/5 bg-black/20 p-2 font-mono text-[10px] leading-relaxed text-zinc-400 whitespace-pre-wrap break-words">
            {lastTerminalOutput}
          </pre>
        </div>
      )}
    </div>
  )
}
