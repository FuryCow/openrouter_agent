import type { ApprovedPlan, ChatMessage } from '../types'
import { getT } from '../i18n/t'
import { parsePlannerPlan } from './parsePlannerPlan'

export function prepareImplementPlan(input: {
  isStreaming: boolean
  messages: ChatMessage[]
  planContent: string
}): { ready: false } | { ready: true; prompt: string; approvedPlan: ApprovedPlan } {
  if (input.isStreaming) return { ready: false }

  const t = getT('chat')
  const originalTask = [...input.messages]
    .reverse()
    .find((message) => message.mode === 'planner' && message.role === 'user')?.content
  const taskLine = originalTask
    ? t('agent.implementPlanPrompt.taskLine', { task: originalTask })
    : ''

  return {
    ready: true,
    prompt: `${taskLine}${t('agent.implementPlanPrompt.body', { plan: input.planContent })}`,
    approvedPlan: parsePlannerPlan(input.planContent)
  }
}
