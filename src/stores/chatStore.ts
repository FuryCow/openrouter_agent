import { create } from 'zustand'
import type {
  ChatMessage,
  TimelineItem,
  ToolCallInfo,
  ChatMode,
  AgentRunAnalytics,
  ApiChatMessage,
  ToolApprovalRequest,
  MemorySuggestRequest,
  MemorySuggestEntry
} from '../types'
import {
  appendTimelineChunk,
  mergeTimelineFromMessage,
  timelineToLegacyFields,
  upsertTimelineTool
} from '../lib/timeline'
import { useTokenUsageStore } from './tokenUsageStore'

let streamBuffer = { text: '', reasoning: '' }
const toolProgressBuffer = new Map<string, ToolCallInfo>()
let flushRaf: number | null = null

interface ChatState {
  chatMode: ChatMode
  messages: ChatMessage[]
  isStreaming: boolean
  activeTimeline: TimelineItem[]
  pendingApproval: ToolApprovalRequest | null
  pendingMemorySuggest: MemorySuggestRequest | null
  setChatMode: (mode: ChatMode) => void
  loadMessages: (mode: ChatMode, messages: ChatMessage[]) => void
  setAllMessages: (messages: ChatMessage[]) => void
  getMessagesForMode: () => ChatMessage[]
  addUserMessage: (content: string, mode?: ChatMode, images?: string[]) => void
  appendStream: (chunk: string) => void
  appendReasoning: (chunk: string) => void
  flushStreamBuffer: () => void
  clearStream: () => void
  setStreaming: (value: boolean) => void
  addToolCall: (toolCall: ToolCallInfo) => void
  updateToolCall: (toolCall: ToolCallInfo) => void
  finalizeAssistantMessage: (
    content: string,
    timeline?: TimelineItem[],
    isError?: boolean,
    runAnalytics?: AgentRunAnalytics,
    interrupted?: boolean,
    apiMessages?: ApiChatMessage[]
  ) => void
  truncateAfterMessage: (messageId: string) => void
  updateUserMessage: (messageId: string, content: string) => void
  clearMessages: () => void
  setPendingApproval: (approval: ToolApprovalRequest | null) => void
  setPendingMemorySuggest: (suggest: MemorySuggestRequest | null) => void
}

function scheduleStreamFlush(
  set: (fn: (s: ChatState) => Partial<ChatState>) => void
): void {
  if (flushRaf !== null) return
  flushRaf = requestAnimationFrame(() => {
    flushRaf = null
    const { text, reasoning } = streamBuffer
    streamBuffer = { text: '', reasoning: '' }
    const pendingTools = [...toolProgressBuffer.values()]
    toolProgressBuffer.clear()
    if (!text && !reasoning && pendingTools.length === 0) return

    set((s) => {
      let timeline = s.activeTimeline
      if (text) timeline = appendTimelineChunk(timeline, 'text', text)
      if (reasoning) timeline = appendTimelineChunk(timeline, 'reasoning', reasoning)
      for (const toolCall of pendingTools) {
        timeline = upsertTimelineTool(timeline, toolCall)
      }
      return { activeTimeline: timeline }
    })
  })
}

export const useChatStore = create<ChatState>((set, get) => ({
  chatMode: 'agent',
  messages: [],
  isStreaming: false,
  activeTimeline: [],
  pendingApproval: null,
  pendingMemorySuggest: null,

  setChatMode: (mode) => set({ chatMode: mode }),
  setPendingApproval: (approval) => set({ pendingApproval: approval }),
  setPendingMemorySuggest: (suggest) => set({ pendingMemorySuggest: suggest }),

  loadMessages: (mode, messages) => {
    const { messages: all } = get()
    const other = all.filter((m) => m.mode !== mode)
    set({ messages: [...other, ...messages] })
  },

  setAllMessages: (messages) => set({ messages }),

  getMessagesForMode: () => {
    const { messages, chatMode } = get()
    return messages.filter((m) => m.mode === chatMode || !m.mode)
  },

  addUserMessage: (content, mode, images) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          mode: mode ?? s.chatMode,
          images
        }
      ]
    })),

  appendStream: (chunk) => {
    streamBuffer.text += chunk
    scheduleStreamFlush(set)
  },

  appendReasoning: (chunk) => {
    streamBuffer.reasoning += chunk
    scheduleStreamFlush(set)
  },

  flushStreamBuffer: () => {
    if (flushRaf !== null) {
      cancelAnimationFrame(flushRaf)
      flushRaf = null
    }
    const { text, reasoning } = streamBuffer
    streamBuffer = { text: '', reasoning: '' }
    const pendingTools = [...toolProgressBuffer.values()]
    toolProgressBuffer.clear()
    if (!text && !reasoning && pendingTools.length === 0) return

    set((s) => {
      let timeline = s.activeTimeline
      if (text) timeline = appendTimelineChunk(timeline, 'text', text)
      if (reasoning) timeline = appendTimelineChunk(timeline, 'reasoning', reasoning)
      for (const toolCall of pendingTools) {
        timeline = upsertTimelineTool(timeline, toolCall)
      }
      return { activeTimeline: timeline }
    })
  },

  clearStream: () => {
    streamBuffer = { text: '', reasoning: '' }
    toolProgressBuffer.clear()
    if (flushRaf !== null) {
      cancelAnimationFrame(flushRaf)
      flushRaf = null
    }
    set({ activeTimeline: [] })
  },

  setStreaming: (value) => set({ isStreaming: value }),

  addToolCall: (toolCall) => {
    get().flushStreamBuffer()
    set((s) => ({
      activeTimeline: upsertTimelineTool(s.activeTimeline, toolCall)
    }))
  },

  updateToolCall: (toolCall) => {
    toolProgressBuffer.set(toolCall.id, toolCall)
    scheduleStreamFlush(set)
  },

  finalizeAssistantMessage: (content, timeline, isError, runAnalytics, interrupted, apiMessages) => {
    get().flushStreamBuffer()
    const { activeTimeline, chatMode } = get()
    const finalTimeline = mergeTimelineFromMessage(activeTimeline, {
      id: '',
      role: 'assistant',
      content,
      timeline
    })

    const legacy = timelineToLegacyFields(finalTimeline)
    const finalContent = isError
      ? content.trim() || 'Request failed'
      : legacy.content || content.trim()

    if (!finalContent && finalTimeline.length === 0 && !isError) return

    if (isError && finalContent) {
      const hasErrorText = finalTimeline.some(
        (item) => item.type === 'text' && item.content.includes(finalContent)
      )
      if (!hasErrorText) {
        finalTimeline.push({
          id: `error-${Date.now()}`,
          type: 'text',
          content: finalContent
        })
      }
    }

    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: finalContent,
          mode: chatMode,
          timeline: finalTimeline.length > 0 ? finalTimeline : undefined,
          reasoning: legacy.reasoning,
          toolCalls: legacy.toolCalls,
          isError,
          interrupted,
          apiMessages,
          runAnalytics
        }
      ],
      activeTimeline: [],
      isStreaming: false
    }))
  },

  truncateAfterMessage: (messageId) => {
    const { messages } = get()
    const index = messages.findIndex((m) => m.id === messageId)
    if (index === -1) return
    set({ messages: messages.slice(0, index + 1) })
  },

  updateUserMessage: (messageId, content) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, content } : m
      )
    })),

  clearMessages: () => {
    const { chatMode, messages } = get()
    set({
      messages: messages.filter((m) => m.mode !== chatMode),
      activeTimeline: [],
      isStreaming: false
    })
    useTokenUsageStore.getState().resetSession()
  }
}))
