import type { ApprovedPlan, ChatMode, ChatFileAttachment } from '../types'
import { prepareImplementPlan } from '../lib/implementPlan'
import { useChatStore } from '../stores/chatStore'
import { useFileStore } from '../stores/fileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { useAgentRunStore } from '../stores/agentRunStore'
import { useAgentContextStore } from '../stores/agentContextStore'
import { buildAgentContextFiles, buildAgentOpenFilesPayload } from '../lib/agentContext'
import { isImagePath } from '../lib/utils'
import { getChatModeConfig } from '../lib/chatModes'
import { getT } from '../i18n/t'
import {
  isEligibleAgentHistoryMessage,
  stripStaleInterruptedApiContext
} from '../../electron/lib/chat-history'

export function useAgent(): {
  sendMessage: (
    message: string,
    options?: {
      mode?: ChatMode
      images?: string[]
      attachedFiles?: ChatFileAttachment[]
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
      attachedFiles?: ChatFileAttachment[]
      skipUserMessage?: boolean
      approvedPlan?: ApprovedPlan
    }
  ): Promise<void> => {
    const tChat = getT('chat')
    const tErrors = getT('errors')
    const { chatMode, addUserMessage, clearStream, setStreaming } = useChatStore.getState()
    const mode = options?.mode ?? chatMode
    const modeConfig = getChatModeConfig(mode, tChat)
    const workingDirectory = useFileStore.getState().workingDirectory || ''
    const settings = useSettingsStore.getState().settings
    const selectedModel = useSettingsStore.getState().models.find((model) => model.id === settings.model)

    if (!settings.apiKey) {
      useSettingsStore.getState().setSettingsOpen(true)
      return
    }

    if (modeConfig.requiresWorkspace && !workingDirectory) {
      useToastStore.getState().addToast(tErrors('agent.noWorkspace'), 'error')
      return
    }

    useChatStore.setState({
      messages: stripStaleInterruptedApiContext(useChatStore.getState().messages)
    })

    if (!options?.skipUserMessage) {
      addUserMessage(message, mode, options?.images, options?.attachedFiles)
    }
    clearStream()
    setStreaming(true)
    useAgentRunStore.getState().resetRunUi()
    useAgentRunStore.getState().setRunStatus('running')

    try {
      const { tabs, activeTabPath } = useFileStore.getState()
      const { pinnedPaths, excludedPaths } = useAgentContextStore.getState()
      const codeTabs = tabs.filter((tab) => !isImagePath(tab.path))
      const contextFiles = buildAgentContextFiles(codeTabs, {
        pinnedPaths,
        excludedPaths,
        activeTabPath
      })
      const openFiles = buildAgentOpenFilesPayload(contextFiles)
      const history = useChatStore
        .getState()
        .messages.filter(
          (m) => (m.mode === mode || !m.mode) && isEligibleAgentHistoryMessage(m)
        )
        .slice(0, -1)

      await window.api.agent.send(message, {
        mode,
        workingDirectory,
        openFiles,
        history,
        model: settings.model,
        temperature: settings.temperature,
        reasoningEffort: settings.reasoningEffort,
        modelProvider: settings.modelProvider,
        reasoningMandatory: selectedModel?.reasoningMandatory,
        reasoningDefaultEffort: selectedModel?.reasoningDefaultEffort,
        reasoningSupportedEfforts: selectedModel?.reasoningSupportedEfforts,
        images: options?.images,
        attachedFiles: options?.attachedFiles,
        customSystemPrompt: settings.customSystemPrompt,
        autoApproveWrites: settings.autoApproveWrites,
        autoApproveTerminal: settings.autoApproveTerminal,
        approvedPlan: options?.approvedPlan
      })
    } catch (err) {
      setStreaming(false)
      const errorText = err instanceof Error ? err.message : tErrors('agent.sendFailed')
      useToastStore.getState().addToast(errorText, 'error')
    }
  }

  const implementPlan = async (planContent: string): Promise<void> => {
    const prepared = prepareImplementPlan({
      isStreaming: useChatStore.getState().isStreaming,
      messages: useChatStore.getState().messages,
      planContent
    })
    if (!prepared.ready) return

    useChatStore.getState().setChatMode('agent')
    useToastStore.getState().addToast(getT('chat')('agent.implementingPlan'), 'info')
    await sendMessage(prepared.prompt, { mode: 'agent', approvedPlan: prepared.approvedPlan })
  }

  const abort = (): void => {
    if (!useChatStore.getState().isStreaming) return
    window.api.agent.abort()
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
      attachedFiles: lastUser.attachedFiles,
      skipUserMessage: true
    })
  }

  return { sendMessage, implementPlan, abort, retryLast }
}
