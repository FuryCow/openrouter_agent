export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function estimateMessagesTokens(
  messages: Array<{ content?: string | null; tool_calls?: unknown[] }>
): number {
  return messages.reduce((sum, m) => {
    let tokens = estimateTokens(m.content ?? '')
    if (m.tool_calls) {
      tokens += estimateTokens(JSON.stringify(m.tool_calls))
    }
    return sum + tokens
  }, 0)
}

export const DEFAULT_CONTEXT_BUDGET = 80_000

export function trimToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) return text
  return `...[truncated ${text.length - maxChars} chars]\n${text.slice(-maxChars)}`
}
