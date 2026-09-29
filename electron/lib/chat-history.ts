import type { ApiChatMessage, ChatMessage } from '../types'
import { estimateTokens, trimToTokenBudget } from './tokens'

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

function isErrorReply(text: string): boolean {
  return text.startsWith('Error:') || text.startsWith('⚠️')
}

function messageTokens(message: ApiChatMessage): number {
  return (
    estimateTokens(message.content ?? '') +
    (message.tool_calls ? estimateTokens(JSON.stringify(message.tool_calls)) : 0)
  )
}

/** Append the visible assistant reply when the tool log does not already end with it. */
export function appendAssistantConclusion(
  apiMessages: ApiChatMessage[],
  content: string | null | undefined
): ApiChatMessage[] {
  const text = content?.trim() ?? ''
  if (!text || isErrorReply(text)) return apiMessages

  const last = apiMessages[apiMessages.length - 1]
  if (
    last?.role === 'assistant' &&
    !last.tool_calls?.length &&
    (last.content ?? '').trim() === text
  ) {
    return apiMessages
  }

  return [...apiMessages, { role: 'assistant', content: text }]
}

function groupHistoryRounds(messages: ApiChatMessage[]): ApiChatMessage[][] {
  const rounds: ApiChatMessage[][] = []
  let index = 0
  while (index < messages.length) {
    const message = messages[index]
    if (message.role === 'assistant' && message.tool_calls?.length) {
      const round = [message]
      index += 1
      while (index < messages.length && messages[index].role === 'tool') {
        round.push(messages[index])
        index += 1
      }
      rounds.push(round)
      continue
    }
    rounds.push([message])
    index += 1
  }
  return rounds
}

function roundTokens(round: ApiChatMessage[]): number {
  return round.reduce((sum, message) => sum + messageTokens(message), 0)
}

/**
 * Keep the newest rounds that fit. A tool call stays with its results.
 * The newest assistant reply without tool calls is kept even when older rounds are dropped.
 */
export function fitHistoryToBudget(messages: ApiChatMessage[], budget: number): ApiChatMessage[] {
  if (budget <= 0 || messages.length === 0) return []

  const rounds = groupHistoryRounds(messages)
  let protectedIndex = -1
  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    const round = rounds[index]
    if (round.length === 1 && round[0].role === 'assistant' && !round[0].tool_calls?.length) {
      protectedIndex = index
      break
    }
  }

  const selected = new Set<number>()
  let used = 0

  if (protectedIndex >= 0) {
    let round = rounds[protectedIndex]
    let cost = roundTokens(round)
    if (cost > budget) {
      const reply = round[0]
      round = [{ ...reply, content: trimToTokenBudget(reply.content ?? '', budget) }]
      rounds[protectedIndex] = round
      cost = roundTokens(round)
    }
    selected.add(protectedIndex)
    used = cost
  }

  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    if (selected.has(index)) continue
    const cost = roundTokens(rounds[index])
    if (used + cost > budget) continue
    selected.add(index)
    used += cost
  }

  return rounds.filter((_, index) => selected.has(index)).flat()
}
