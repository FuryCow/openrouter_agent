import type { AgentRunStatus, TaskChecklistStepState } from '@/types'

export function getActiveChecklistStep(
  steps: TaskChecklistStepState[] | null | undefined
): { index: number; step: TaskChecklistStepState } | null {
  if (!steps || steps.length === 0) return null

  const inProgressIndex = steps.findIndex((step) => step.status === 'in_progress')
  if (inProgressIndex >= 0) {
    return { index: inProgressIndex, step: steps[inProgressIndex]! }
  }

  const pendingIndex = steps.findIndex((step) => step.status === 'pending')
  if (pendingIndex >= 0) {
    return { index: pendingIndex, step: steps[pendingIndex]! }
  }

  const lastIndex = steps.length - 1
  return { index: lastIndex, step: steps[lastIndex]! }
}

export function formatRunStatusLine(
  runStatus: AgentRunStatus | null,
  checklist: TaskChecklistStepState[] | null,
  labels: {
    running: string
    awaitingApproval: string
    completed: string
    error: string
    aborted: string
    maxIterations: string
    step: (current: number, total: number, text: string) => string
  }
): string | null {
  if (!runStatus) return null

  const active = getActiveChecklistStep(checklist)
  if (active && checklist && checklist.length > 0 && runStatus === 'running') {
    return labels.step(active.index + 1, checklist.length, active.step.text)
  }

  switch (runStatus) {
    case 'running':
      return labels.running
    case 'awaiting_approval':
      return labels.awaitingApproval
    case 'completed':
      return labels.completed
    case 'error':
      return labels.error
    case 'aborted':
      return labels.aborted
    case 'max_iterations':
      return labels.maxIterations
    default:
      return null
  }
}
