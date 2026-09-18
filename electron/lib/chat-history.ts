import type { ApiChatMessage, ChatMessage } from '../types'

export function retainToolApiMessagesOnly(apiMessages: ApiChatMessage[]): ApiChatMessage[] {
  return apiMessages.filter((message) => message.role === 'assistant' || message.role === 'tool')
}

export function hasRetainedApiContext(message: ChatMessage): boolean {
  return Boolean(message.apiMessages && message.apiMessages.length > 0 && message.interrupted)
}

/** Drop tool context from older interrupted runs; keep only on the latest chat message. */
export function stripStaleInterruptedApiContext(messages: ChatMessage[]): ChatMessage[] {
  const lastIdx = messages.length - 1
  return messages.map((message, index) => {
    if (!message.interrupted || !message.apiMessages?.length || index === lastIdx) {
      return message
    }
    return { ...message, apiMessages: undefined }
  })
}

export function isEligibleAgentHistoryMessage(message: ChatMessage): boolean {
  if (message.role !== 'user' && message.role !== 'assistant') return false

  if (hasRetainedApiContext(message)) return true

  if (message.isError) return false
  if (!message.content?.trim()) return false

  if (
    message.role === 'assistant' &&
    (message.content.startsWith('Error:') || message.content.startsWith('⚠️'))
  ) {
    return false
  }

  return true
}
