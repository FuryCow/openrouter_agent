import type { ToolCall } from '../services/openrouter'

export interface SseStreamDelta {
  content?: string
  reasoning?: string
  reasoning_details?: Array<{ type?: string; text?: string; summary?: string }>
  tool_calls?: Array<{
    index: number
    id?: string
    function?: { name?: string; arguments?: string }
  }>
}

export interface SseStreamChoice {
  finish_reason: string | null
  delta: SseStreamDelta
}

export interface SseStreamChunk {
  error?: unknown
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  choices?: SseStreamChoice[]
}

export function extractReasoningFromDelta(delta: SseStreamDelta): string {
  let fromDetails = ''

  if (delta.reasoning_details?.length) {
    for (const detail of delta.reasoning_details) {
      const chunk = detail.text ?? detail.summary
      if (chunk && chunk !== '[REDACTED]') {
        fromDetails += chunk
      }
    }
  }

  if (fromDetails) return fromDetails
  return delta.reasoning ?? ''
}

export function splitSseBuffer(buffer: string): { lines: string[]; remainder: string } {
  const lines = buffer.split('\n')
  const remainder = lines.pop() || ''
  return { lines, remainder }
}

export function parseSseDataLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data: ')) return null
  const data = trimmed.slice(6)
  if (data === '[DONE]') return null
  return data
}

export function mergeToolCallDelta(
  toolCallsMap: Map<number, ToolCall>,
  toolCalls: SseStreamDelta['tool_calls']
): ToolCall[] {
  const updated: ToolCall[] = []
  if (!toolCalls) return updated

  for (const tc of toolCalls) {
    const existing = toolCallsMap.get(tc.index)
    if (!existing) {
      toolCallsMap.set(tc.index, {
        id: tc.id || `call_${tc.index}`,
        type: 'function',
        function: {
          name: tc.function?.name || '',
          arguments: tc.function?.arguments || ''
        }
      })
    } else {
      if (tc.id) existing.id = tc.id
      if (tc.function?.name) existing.function.name = tc.function.name
      if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
    }

    const current = toolCallsMap.get(tc.index)
    if (current) updated.push(current)
  }

  return updated
}
