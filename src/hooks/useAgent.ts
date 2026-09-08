import type { ApprovedPlan, ChatMode } from '../types'
import { parsePlannerPlan } from '../lib/parsePlannerPlan'
import { useChatStore } from '../stores/chatStore'
import { useFileStore } from '../stores/fileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { useAgentRunStore } from '../stores/agentRunStore'
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
    options?: {
      mode?: ChatMode
      images?: string[]
      skipUserMessage?: boolean
      approvedPlan?: ApprovedPlan
    }
  ) => Promise<void>
  implementPlan: (planContent: string) => Promise<void>
  abort: () => void
  retryLast: () => Promise<void>
} {
  const sendMessage = async (
    message: string,
    options?: {
      mode?: ChatMode
      images?: string[]
      skipUserMessage?: boolean
      approvedPlan?: ApprovedPlan
    }
  ): Promise<void> => {
    const { chatMode, addUserMessage, clearStream, setStreaming } = useChatStore.getState()
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
    useAgentRunStore.getState().setRunStatus('running')

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
        autoApproveTerminal: settings.autoApproveTerminal,
        approvedPlan: options?.approvedPlan
      })
    } catch (err) {
      setStreaming(false)
      const errorText = err instanceof Error ? err.message : 'Failed to send message'
      useToastStore.getState().addToast(errorText, 'error')
    }
  }

  const implementPlan = async (planContent: string): Promise<void> => {
    if (useChatStore.getState().isStreaming) return

    const { messages, setChatMode } = useChatStore.getState()
    const plannerMessages = messages.filter((m) => m.mode === 'planner')
    const originalTask = [...plannerMessages]
      .reverse()
      .find((m) => m.role === 'user')?.content

    setChatMode('agent')
    useToastStore.getState().addToast('Режим Агента — реализация плана', 'info')

    const approvedPlan = parsePlannerPlan(planContent)
    const prompt = buildImplementPlanPrompt(planContent, originalTask)
    await sendMessage(prompt, { mode: 'agent', approvedPlan })
  }

  const abort = (): void => {
    window.api.agent.abort()
    const { setStreaming, finalizeAssistantMessage, activeTimeline } = useChatStore.getState()
    setStreaming(false)
    finalizeAssistantMessage(
      '⚠️ Run aborted.',
      activeTimeline.length > 0 ? [...activeTimeline] : undefined,
      true,
      undefined,
      true
    )
  }

  const retryLast = async (): Promise<void> => {
    const { chatMode, messages, truncateAfterMessage } = useChatStore.getState()
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
