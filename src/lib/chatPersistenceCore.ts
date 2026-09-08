import type { ChatMessage, ChatMode } from '@/types'

export const CHAT_PERSISTENCE_MODES: ChatMode[] = ['agent', 'ask', 'planner']

export function resolveMessageMode(message: ChatMessage): ChatMode {
  return message.mode ?? 'agent'
}

export function messagesForMode(messages: ChatMessage[], mode: ChatMode): ChatMessage[] {
  return messages.filter((message) => resolveMessageMode(message) === mode)
}
