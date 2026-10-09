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

/** Fallback when the model does not report context_length. */
export const FALLBACK_CONTEXT_LENGTH = 128_000

/** Share of the model context reserved for history + tool outputs. */
const HISTORY_BUDGET_RATIO = 0.6

/** Share of the model context (in chars) reserved for read tool outputs. */
const READ_BUDGET_RATIO = 0.4

/** Share of the model context reserved for history + tool outputs. */
export function resolveContextBudget(modelContextLength?: number): number {
  const limit = modelContextLength ?? FALLBACK_CONTEXT_LENGTH
  return Math.max(16_000, Math.floor(limit * HISTORY_BUDGET_RATIO))
}

export function resolveReadBudgetChars(modelContextLength?: number): {
  perFile: number
  total: number
  maxFiles: number
} {
  const limit = modelContextLength ?? FALLBACK_CONTEXT_LENGTH
  const readBudgetChars = Math.floor(limit * 4 * READ_BUDGET_RATIO)
  const maxFiles = 20
  return {
    perFile: Math.max(50_000, Math.floor(readBudgetChars / 3)),
    total: Math.max(150_000, readBudgetChars),
    maxFiles
  }
}

export function trimToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) return text
  return `...[truncated ${text.length - maxChars} chars]\n${text.slice(-maxChars)}`
}
