import type { ChatMessage } from '../types'

export function hasRetainedApiContext(message: ChatMessage): boolean {
  return Boolean(message.apiMessages && message.apiMessages.length > 0 && message.interrupted)
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
