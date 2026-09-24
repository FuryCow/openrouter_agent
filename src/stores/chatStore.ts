import { create } from 'zustand'
import type {
  ChatMessage,
  TimelineItem,
  ToolCallInfo,
  ChatMode,
  AgentRunAnalytics,
  AgentRunOutcome,
  ApiChatMessage,
  ToolApprovalRequest,
  MemorySuggestRequest,
  MemorySuggestEntry,
  ChatFileAttachment
} from '../types'
import {
  appendTimelineChunk,
  mergeTimelineFromMessage,
  shouldFoldTextIntoReasoning,
  timelineToLegacyFields,
  upsertTimelineTool
} from '../lib/timeline'
import { useTokenUsageStore } from './tokenUsageStore'

let streamEvents: Array<
  | { kind: 'text'; chunk: string }
  | { kind: 'reasoning'; chunk: string }
  | { kind: 'tool'; toolCall: ToolCallInfo }
> = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
const STREAM_FLUSH_MS = 100
const MAX_STREAMING_REASONING_CHARS = 250_000

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
  addUserMessage: (
    content: string,
    mode?: ChatMode,
    images?: string[],
    attachedFiles?: ChatFileAttachment[]
  ) => void
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
    apiMessages?: ApiChatMessage[],
    runOutcome?: AgentRunOutcome
  ) => void
  truncateAfterMessage: (messageId: string) => void
  updateUserMessage: (messageId: string, content: string) => void
  clearMessages: () => void
  setPendingApproval: (approval: ToolApprovalRequest | null) => void
  setPendingMemorySuggest: (suggest: MemorySuggestRequest | null) => void
}

function pushStreamEvent(event: (typeof streamEvents)[number]): void {
  const last = streamEvents[streamEvents.length - 1]
  if (event.kind !== 'tool' && last?.kind === event.kind) {
    last.chunk += event.chunk
    return
  }
  if (event.kind === 'tool' && last?.kind === 'tool' && last.toolCall.id === event.toolCall.id) {
    last.toolCall = event.toolCall
    return
  }
  streamEvents.push(event)
}

function applyStreamEvents(timeline: TimelineItem[]): TimelineItem[] {
  let next = timeline
  let reasoningChars = next
    .filter((item) => item.type === 'reasoning')
    .reduce((sum, item) => sum + item.content.length, 0)

  for (const event of streamEvents) {
    if (event.kind === 'tool') {
      next = upsertTimelineTool(next, event.toolCall)
      continue
    }
    let chunk = event.chunk
    if (event.kind === 'reasoning' || shouldFoldTextIntoReasoning(next[next.length - 1], chunk)) {
      const room = MAX_STREAMING_REASONING_CHARS - reasoningChars
      if (room <= 0) continue
      if (chunk.length > room) chunk = chunk.slice(0, room)
      reasoningChars += chunk.length
    }
    next = appendTimelineChunk(next, event.kind === 'reasoning' ? 'reasoning' : 'text', chunk)
  }

  streamEvents = []
  return next
}

function scheduleStreamFlush(
  set: (fn: (s: ChatState) => Partial<ChatState>) => void
): void {
  if (flushTimer !== null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    if (streamEvents.length === 0) return
    set((s) => ({ activeTimeline: applyStreamEvents(s.activeTimeline) }))
  }, STREAM_FLUSH_MS)
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

  addUserMessage: (content, mode, images, attachedFiles) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          mode: mode ?? s.chatMode,
          images,
          attachedFiles
        }
      ]
    })),

  appendStream: (chunk) => {
    if (!chunk) return
    pushStreamEvent({ kind: 'text', chunk })
    scheduleStreamFlush(set)
  },

  appendReasoning: (chunk) => {
    if (!chunk) return
    pushStreamEvent({ kind: 'reasoning', chunk })
    scheduleStreamFlush(set)
  },

  flushStreamBuffer: () => {
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    if (streamEvents.length === 0) return
    set((s) => ({ activeTimeline: applyStreamEvents(s.activeTimeline) }))
  },

  clearStream: () => {
    streamEvents = []
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
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
    pushStreamEvent({ kind: 'tool', toolCall })
    scheduleStreamFlush(set)
  },

  finalizeAssistantMessage: (
    content,
    timeline,
    isError,
    runAnalytics,
    interrupted,
    apiMessages,
    runOutcome
  ) => {
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

    if (!finalContent && finalTimeline.length === 0 && !isError && !apiMessages?.length && !interrupted) {
      return
    }

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
          runAnalytics,
          runOutcome
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
