import type { AppSettings, ModelInfo, TokenUsage } from '../types'
import { AppError, AppErrorCode } from '../lib/app-errors'
import { fetchAgentVisionModels } from './models'
import { apiFetch } from './http'
import { isRetryableOpenRouterError } from '../lib/agent-run-guards'
import {
  extractReasoningFromDelta,
  mergeToolCallDelta,
  parseSseDataLine,
  splitSseBuffer,
  type SseStreamChunk
} from '../lib/openrouter-sse'

const API_BASE = 'https://openrouter.ai/api/v1'

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content:
    | string
    | null
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface StreamResult {
  content: string
  reasoning: string
  toolCalls: ToolCall[]
  finishReason: string | null
  usage?: TokenUsage
}

export function formatApiError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'OpenRouter request failed'
  }

  const record = payload as {
    message?: string
    code?: number | string
    metadata?: { raw?: string; provider_name?: string }
    error?: {
      message?: string
      code?: number | string
      metadata?: { raw?: string; provider_name?: string }
    }
  }

  const nested = record.error
  const message = nested?.message || record.message || 'OpenRouter request failed'
  const metadata = nested?.metadata || record.metadata
  const parts = [message]

  if (metadata?.provider_name) {
    parts.push(`Provider: ${metadata.provider_name}`)
  }

  if (metadata?.raw) {
    try {
      const raw = JSON.parse(metadata.raw) as {
        error?: { message?: string }
        message?: string
      }
      const rawMessage = raw.error?.message || raw.message
      if (rawMessage && rawMessage !== message) {
        parts.push(rawMessage)
      } else if (!rawMessage) {
        parts.push(metadata.raw.slice(0, 400))
      }
    } catch {
      parts.push(metadata.raw.slice(0, 400))
    }
  }

  const code = nested?.code ?? record.code
  if (code) {
    parts.push(`Code: ${code}`)
  }

  if (/idle timeout/i.test(message)) {
    parts.push(
      'Модель слишком долго не отдавала данные (часто при большом write_file). Используйте search_replace или разбейте задачу.'
    )
  }

  return parts.join(' — ')
}

export class OpenRouterClient {
  constructor(private settings: AppSettings) {}

  updateSettings(settings: AppSettings): void {
    this.settings = settings
  }

  hasApiKey(): boolean {
    return Boolean(this.settings.apiKey?.trim())
  }

  async listModels(): Promise<ModelInfo[]> {
    return fetchAgentVisionModels(this.settings.apiKey)
  }

  async streamCompletion(
    messages: ChatCompletionMessage[],
    tools: ToolDefinition[],
    options: {
      onChunk?: (text: string) => void
      onReasoningChunk?: (text: string) => void
      onToolCallProgress?: (toolCall: ToolCall) => void
      signal?: AbortSignal
      model?: string
      temperature?: number
      maxTokens?: number
    } = {}
  ): Promise<StreamResult> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.streamCompletionOnce(messages, tools, options)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        lastError = err
        const retryable = isRetryableOpenRouterError(err.message)
        if (attempt === 0 && retryable) {
          console.warn('[OpenRouter] Idle timeout, retrying request...')
          continue
        }
        throw err
      }
    }

    throw lastError ?? new AppError(AppErrorCode.OPENROUTER_REQUEST_FAILED)
  }

  private async streamCompletionOnce(
    messages: ChatCompletionMessage[],
    tools: ToolDefinition[],
    options: {
      onChunk?: (text: string) => void
      onReasoningChunk?: (text: string) => void
      onToolCallProgress?: (toolCall: ToolCall) => void
      signal?: AbortSignal
      model?: string
      temperature?: number
      maxTokens?: number
    }
  ): Promise<StreamResult> {
    const { onChunk, onReasoningChunk, onToolCallProgress, signal, model, temperature, maxTokens } =
      options
    const apiKey = this.settings.apiKey?.trim()
    if (!apiKey) {
      throw new AppError(AppErrorCode.OPENROUTER_API_KEY_MISSING)
    }

    let response: Response
    try {
      response = await apiFetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(apiKey),
          'Content-Type': 'application/json',
          Accept: 'text/event-stream'
        },
        body: JSON.stringify({
          model: model ?? this.settings.model,
          messages,
          ...(tools.length > 0 ? { tools } : {}),
          ...(temperature !== undefined ? { temperature } : {}),
          ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
          provider: { allow_fallbacks: true },
          stream: true
        }),
        signal
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(AppErrorCode.OPENROUTER_CONNECTION_FAILED)
    }

    if (!response.ok) {
      const err = await response.text()
      let message = `OpenRouter error ${response.status}`
      try {
        message = formatApiError(JSON.parse(err))
      } catch {
        if (err) message = `${message}: ${err.slice(0, 300)}`
      }
      throw new Error(message)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new AppError(AppErrorCode.OPENROUTER_NO_RESPONSE_BODY)

    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let reasoning = ''
    const toolCallsMap = new Map<number, ToolCall>()
    let finishReason: string | null = null
    let usage: TokenUsage | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const split = splitSseBuffer(buffer)
      buffer = split.remainder

      for (const line of split.lines) {
        const data = parseSseDataLine(line)
        if (!data) continue

        try {
          const parsed = JSON.parse(data) as SseStreamChunk

          if (parsed.error) {
            throw new Error(formatApiError(parsed))
          }

          if (parsed.usage) {
            usage = {
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
              totalTokens: parsed.usage.total_tokens ?? 0
            }
          }

          const choice = parsed.choices?.[0]
          if (!choice) continue

          finishReason = choice.finish_reason

          const reasoningChunk = extractReasoningFromDelta(choice.delta)
          if (reasoningChunk) {
            reasoning += reasoningChunk
            onReasoningChunk?.(reasoningChunk)
          }

          if (choice.delta.content) {
            content += choice.delta.content
            onChunk?.(choice.delta.content)
          }

          for (const current of mergeToolCallDelta(toolCallsMap, choice.delta.tool_calls)) {
            onToolCallProgress?.(current)
          }
        } catch (error) {
          if (error instanceof SyntaxError) continue
          throw error
        }
      }
    }

    return {
      content,
      reasoning,
      toolCalls: Array.from(toolCallsMap.values()),
      finishReason,
      usage
    }
  }

  private getHeaders(apiKey?: string): Record<string, string> {
    const key = (apiKey ?? this.settings.apiKey)?.trim()
    return {
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://openrouter-agent.local',
      'X-Title': 'OpenRouter Agent'
    }
  }
}
