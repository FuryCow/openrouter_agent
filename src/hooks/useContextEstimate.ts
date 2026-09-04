import { useState, useEffect, useMemo } from 'react'
import type { ChatMessage, ChatMode, TimelineItem } from '@/types'
import { estimateTokens } from '@/lib/tokens'
import { useChatStore } from '@/stores/chatStore'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'

const SYSTEM_PROMPT_OVERHEAD = 1200
const STREAM_SAMPLE_MS = 500

export interface ContextEstimate {
  estimatedContext: number
  contextLimit: number
  contextPercent: number
}

function estimateMessageTokens(message: ChatMessage): number {
  let tokens = estimateTokens(message.content)
  if (message.timeline?.length) {
    for (const item of message.timeline) {
      if (item.type === 'text' || item.type === 'reasoning') {
        tokens += estimateTokens(item.content)
      } else if (item.type === 'tool' && item.toolCall) {
        tokens += estimateTokens(item.toolCall.arguments)
        tokens += estimateTokens(item.toolCall.result ?? '')
      }
    }
  }
  if (message.apiMessages?.length) {
    for (const apiMsg of message.apiMessages) {
      tokens += estimateTokens(apiMsg.content ?? '')
      if (apiMsg.tool_calls) {
        tokens += estimateTokens(JSON.stringify(apiMsg.tool_calls))
      }
    }
  }
  return tokens
}

function estimateTimelineTokens(timeline: TimelineItem[]): number {
  let tokens = 0
  for (const item of timeline) {
    if (item.type === 'text' || item.type === 'reasoning') {
      tokens += estimateTokens(item.content)
    } else if (item.type === 'tool' && item.toolCall) {
      tokens += estimateTokens(item.toolCall.arguments)
      tokens += estimateTokens(item.toolCall.result ?? '')
    }
  }
  return tokens
}

export function computeContextEstimate(input: {
  messages: ChatMessage[]
  chatMode: ChatMode
  activeTimeline: TimelineItem[]
  isStreaming: boolean
  customSystemPrompt: string
  tabs: Array<{ content: string }>
  contextLimit: number
}): ContextEstimate {
  const modeMessages = input.messages.filter((m) => m.mode === input.chatMode || !m.mode)

  let estimatedContext =
    SYSTEM_PROMPT_OVERHEAD + estimateTokens(input.customSystemPrompt ?? '')

  for (const message of modeMessages) {
    estimatedContext += estimateMessageTokens(message)
  }

  if (input.isStreaming && input.activeTimeline.length > 0) {
    estimatedContext += estimateTimelineTokens(input.activeTimeline)
  }

  if (input.tabs.length > 0) {
    let used = 0
    const perFileLimit = 4000
    const totalLimit = 12000
    for (const tab of input.tabs) {
      const block = estimateTokens(tab.content.slice(0, perFileLimit))
      if (used + block > totalLimit) break
      used += block
    }
    estimatedContext += used
  }

  const contextPercent =
    input.contextLimit > 0
      ? Math.min(100, Math.round((estimatedContext / input.contextLimit) * 100))
      : 0

  return {
    estimatedContext,
    contextLimit: input.contextLimit,
    contextPercent
  }
}

/** Read current estimate from stores without subscribing to activeTimeline. */
export function readContextEstimateFromStores(): ContextEstimate {
  const chat = useChatStore.getState()
  const settings = useSettingsStore.getState()
  const tabs = useFileStore.getState().tabs
  const contextLimit =
    settings.models.find((m) => m.id === settings.settings.model)?.contextLength ?? 128_000

  return computeContextEstimate({
    messages: chat.messages,
    chatMode: chat.chatMode,
    activeTimeline: chat.activeTimeline,
    isStreaming: chat.isStreaming,
    customSystemPrompt: settings.settings.customSystemPrompt ?? '',
    tabs,
    contextLimit
  })
}

export function useContextEstimate(): ContextEstimate {
  const messages = useChatStore((s) => s.messages)
  const chatMode = useChatStore((s) => s.chatMode)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const customSystemPrompt = useSettingsStore((s) => s.settings.customSystemPrompt ?? '')
  const modelId = useSettingsStore((s) => s.settings.model)
  const models = useSettingsStore((s) => s.models)
  const tabs = useFileStore((s) => s.tabs)

  const contextLimit = models.find((m) => m.id === modelId)?.contextLength ?? 128_000

  const stableKey = useMemo(
    () => ({ messages, chatMode, customSystemPrompt, tabs, contextLimit }),
    [messages, chatMode, customSystemPrompt, tabs, contextLimit]
  )

  const [estimate, setEstimate] = useState<ContextEstimate>(() => readContextEstimateFromStores())

  useEffect(() => {
    const refresh = (): void => {
      setEstimate(
        computeContextEstimate({
          ...stableKey,
          activeTimeline: useChatStore.getState().activeTimeline,
          isStreaming: useChatStore.getState().isStreaming
        })
      )
    }

    refresh()

    if (!isStreaming) return

    const id = window.setInterval(refresh, STREAM_SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [stableKey, isStreaming])

  return estimate
}
