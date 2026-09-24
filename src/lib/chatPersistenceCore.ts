import type { ChatMessage, ChatMode } from '@/types'

export const CHAT_PERSISTENCE_MODES: ChatMode[] = ['agent', 'ask', 'planner']

export function resolveMessageMode(message: ChatMessage): ChatMode {
  return message.mode ?? 'agent'
}

export function messagesForMode(messages: ChatMessage[], mode: ChatMode): ChatMessage[] {
  return messages.filter((message) => resolveMessageMode(message) === mode)
}

export function latestChatMode(messages: ChatMessage[], fallback: ChatMode = 'agent'): ChatMode {
  let bestMode = fallback
  let bestTs = -1
  for (const message of messages) {
    const ts = Number(/-(\d+)$/.exec(message.id)?.[1] ?? Number.NaN)
    if (!Number.isFinite(ts) || ts < bestTs) continue
    bestTs = ts
    bestMode = resolveMessageMode(message)
  }
  return bestMode
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
