import { useEffect } from 'react'
import type { ChatMode } from '../types'
import { useChatStore } from '../stores/chatStore'
import { useFileStore } from '../stores/fileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { getChatModeConfig } from '../lib/chatModes'

function buildImplementPlanPrompt(planContent: string, originalTask?: string): string {
  const taskLine = originalTask
    ? `Исходная задача пользователя:\n${originalTask}\n\n`
    : ''

  return `${taskLine}Реализуй согласно плану ниже. Выполняй шаги по порядку, используй инструменты, не отклоняйся от плана без необходимости.

---

${planContent}`
}

export function useAgent(): {
  sendMessage: (
    message: string,
    options?: { mode?: ChatMode; images?: string[]; skipUserMessage?: boolean }
  ) => Promise<void>
  implementPlan: (planContent: string) => Promise<void>
  abort: () => void
  retryLast: () => Promise<void>
} {
  const {
    chatMode,
    messages,
    setChatMode,
    addUserMessage,
    appendStream,
    appendReasoning,
    clearStream,
    setStreaming,
    addToolCall,
    updateToolCall,
    finalizeAssistantMessage,
    truncateAfterMessage
  } = useChatStore()

  useEffect(() => {
    const unsubscribe = window.api.agent.onEvent((event) => {
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
            event.message?.apiMessages
          )
          setStreaming(false)
          if (event.message?.isError && event.message?.content) {
            useToastStore.getState().addToast(event.message.content, 'error')
          }
          break
        case 'run_analytics':
          if (event.analytics) {
            useAnalyticsStore.getState().addRun(event.analytics)
          }
          break
        case 'approval_request':
          if (event.approval) {
            useChatStore.getState().setPendingApproval(event.approval)
          }
          break
        case 'error': {
          const errorText = event.error || 'Request failed'
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
    })
    return unsubscribe
  }, [
    appendStream,
    appendReasoning,
    addToolCall,
    updateToolCall,
    finalizeAssistantMessage,
    setStreaming
  ])

  const sendMessage = async (
    message: string,
    options?: { mode?: ChatMode; images?: string[]; skipUserMessage?: boolean }
  ): Promise<void> => {
    const mode = options?.mode ?? chatMode
    const modeConfig = getChatModeConfig(mode)
    const workingDirectory = useFileStore.getState().workingDirectory || ''
    const settings = useSettingsStore.getState().settings

    if (!settings.apiKey) {
      useSettingsStore.getState().setSettingsOpen(true)
      return
    }

    if (modeConfig.requiresWorkspace && !workingDirectory) {
      useToastStore.getState().addToast(
        'Open a project folder in Explorer first (not the agent app folder).',
        'error'
      )
      return
    }

    if (!options?.skipUserMessage) {
      addUserMessage(message, mode, options?.images)
    }
    clearStream()
    setStreaming(true)

    try {
      const openFiles = useFileStore.getState().getOpenFilesContext()
      const history = useChatStore
        .getState()
        .messages.filter(
          (m) =>
            (m.mode === mode || !m.mode) &&
            m.role !== 'tool' &&
            !m.isError
        )
        .slice(0, -1)

      await window.api.agent.send(message, {
        mode,
        workingDirectory,
        openFiles,
        history,
        model: settings.model,
        temperature: settings.temperature,
        images: options?.images,
        customSystemPrompt: settings.customSystemPrompt,
        autoApproveWrites: settings.autoApproveWrites,
        autoApproveTerminal: settings.autoApproveTerminal
      })
    } catch (err) {
      setStreaming(false)
      const errorText = err instanceof Error ? err.message : 'Failed to send message'
      useToastStore.getState().addToast(errorText, 'error')
    }
  }

  const implementPlan = async (planContent: string): Promise<void> => {
    if (useChatStore.getState().isStreaming) return

    const plannerMessages = messages.filter((m) => m.mode === 'planner')
    const originalTask = [...plannerMessages]
      .reverse()
      .find((m) => m.role === 'user')?.content

    setChatMode('agent')
    useToastStore.getState().addToast('Режим Агента — реализация плана', 'info')

    const prompt = buildImplementPlanPrompt(planContent, originalTask)
    await sendMessage(prompt, { mode: 'agent' })
  }

  const abort = (): void => {
    window.api.agent.abort()
    setStreaming(false)
    const { activeTimeline } = useChatStore.getState()
    finalizeAssistantMessage(
      '⚠️ Run aborted.',
      activeTimeline.length > 0 ? [...activeTimeline] : undefined,
      true,
      undefined,
      true
    )
  }

  const retryLast = async (): Promise<void> => {
    const mode = chatMode
    const modeMessages = messages.filter((m) => m.mode === mode || !m.mode)
    const lastUser = [...modeMessages].reverse().find((m) => m.role === 'user')
    if (!lastUser || useChatStore.getState().isStreaming) return

    truncateAfterMessage(lastUser.id)

    await sendMessage(lastUser.content, {
      mode,
      images: lastUser.images,
      skipUserMessage: true
    })
  }

  return { sendMessage, implementPlan, abort, retryLast }
}
