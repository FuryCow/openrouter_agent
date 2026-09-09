import { useChatStore } from '@/stores/chatStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { useTokenUsageStore } from '@/stores/tokenUsageStore'
import { useAgentRunStore } from '@/stores/agentRunStore'
import { useToastStore } from '@/stores/toastStore'
import { resolveErrorMessage } from '@/lib/errorMessages'
import { getT } from '@/i18n/t'
import type { AgentEvent } from '@/types'

let unsubscribe: (() => void) | null = null

function handleAgentEvent(event: AgentEvent): void {
  const {
    appendStream,
    appendReasoning,
    addToolCall,
    updateToolCall,
    finalizeAssistantMessage,
    setStreaming
  } = useChatStore.getState()

  switch (event.type) {
    case 'stream':
      if (event.content) appendStream(event.content)
      break
    case 'reasoning_stream':
      if (event.content) appendReasoning(event.content)
      break
    case 'tool_start':
      if (event.toolCall) addToolCall(event.toolCall)
      break
    case 'tool_progress':
      if (event.toolCall) updateToolCall(event.toolCall)
      break
    case 'tool_done':
      if (event.toolCall) updateToolCall(event.toolCall)
      break
    case 'done':
      finalizeAssistantMessage(
        event.message?.content || '',
        event.message?.timeline,
        event.message?.isError ?? false,
        event.message?.runAnalytics,
        event.message?.interrupted,
        event.message?.apiMessages,
        event.message?.runOutcome
      )
      setStreaming(false)
      if (event.message?.isError && event.message?.content) {
        useToastStore.getState().addToast(event.message.content, 'error')
      }
      break
    case 'run_analytics':
      if (event.analytics) {
        useAnalyticsStore.getState().addRun(event.analytics)
        useTokenUsageStore.getState().addUsage(event.analytics.tokenUsage)
      }
      break
    case 'approval_request':
      if (event.approval) {
        useChatStore.getState().setPendingApproval(event.approval)
      }
      break
    case 'memory_suggest':
      if (event.memorySuggest) {
        useChatStore.getState().setPendingMemorySuggest(event.memorySuggest)
      }
      break
    case 'run_status':
      if (event.runStatus) {
        useAgentRunStore.getState().setRunStatus(event.runStatus)
      }
      break
    case 'checkpoint_updated':
      if (event.checkpoint) {
        useAgentRunStore.getState().setCheckpoint(event.checkpoint)
        useAgentRunStore.getState().showChangesPanel()
      }
      break
    case 'checklist_updated':
      if (event.checklist) {
        useAgentRunStore.getState().setChecklist(event.checklist.steps)
      }
      break
    case 'terminal_output':
      if (event.content) {
        useAgentRunStore.getState().setLastTerminalOutput(event.content)
      }
      break
    case 'iteration_warning':
      if (event.error) {
        useToastStore.getState().addToast(event.error, 'info')
      }
      break
    case 'error': {
      const errorText = resolveErrorMessage(
        event.errorCode,
        event.errorParams,
        event.error,
        getT('errors')
      )
      const { activeTimeline } = useChatStore.getState()
      finalizeAssistantMessage(
        errorText,
        activeTimeline.length > 0 ? [...activeTimeline] : undefined,
        true
      )
      useToastStore.getState().addToast(errorText, 'error')
      setStreaming(false)
      break
    }
  }
}

export function initAgentEvents(): () => void {
  unsubscribe?.()
  unsubscribe = window.api.agent.onEvent(handleAgentEvent)

  void window.api.agent.getRunCheckpoint().then((checkpoint) => {
    if (checkpoint) {
      useAgentRunStore.getState().setCheckpoint(checkpoint)
    }
  })

  return () => {
    unsubscribe?.()
    unsubscribe = null
  }
}
