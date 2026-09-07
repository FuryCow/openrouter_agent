import type { ChatMessage } from '@/types'

export function getMessageRememberContent(message: Pick<ChatMessage, 'content' | 'timeline'>): string {
  if (message.content?.trim()) return message.content.trim()

  const textParts =
    message.timeline
      ?.filter((item) => item.type === 'text')
      .map((item) => item.content.trim())
      .filter(Boolean) ?? []

  return textParts.join('\n\n').trim()
}
