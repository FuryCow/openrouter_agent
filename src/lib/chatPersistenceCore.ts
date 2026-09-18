import type { ChatMessage, ChatMode } from '@/types'

export const CHAT_PERSISTENCE_MODES: ChatMode[] = ['agent', 'ask', 'planner']

export function resolveMessageMode(message: ChatMessage): ChatMode {
  return message.mode ?? 'agent'
}

export function messagesForMode(messages: ChatMessage[], mode: ChatMode): ChatMessage[] {
  return messages.filter((message) => resolveMessageMode(message) === mode)
}

/** undefined = wait for fileStore hydration; null/string = ready workspace */
export function resolvePersistenceWorkspace(
  hydrated: boolean,
  workingDirectory: string | null,
  settingsWorkingDirectory?: string | null
): string | null | undefined {
  if (!hydrated) return undefined
  const settingsWorkspace = settingsWorkingDirectory?.trim() || null
  if (workingDirectory === null && settingsWorkspace !== null) return undefined
  return workingDirectory ?? settingsWorkspace
}
