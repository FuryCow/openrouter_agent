import type { OpenRouterClient, ChatCompletionMessage } from '../openrouter'
import type { SkillDraft } from '../../types'
import {
  buildDistillUserPrompt,
  getDistillSystemPrompt,
  parseDistillResponse,
  type DistillInput
} from './skill-distill'

const MIN_NAME_LENGTH = 3
const MAX_NAME_LENGTH = 64
const MAX_BODY_CHARS = 20_000

export interface DistillOptions {
  /** Model used for the reflection call. Defaults to the client's configured model. */
  model?: string
}

function sanitizeSkillName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
}

/**
 * Reflects on a successful agent run and produces a SKILL.md draft via the LLM.
 * Uses streaming under the hood (the client has no non-streaming method) but does
 * not forward chunks — the caller receives the parsed draft only.
 */
export async function distillSessionIntoSkill(
  client: OpenRouterClient,
  input: DistillInput,
  options: DistillOptions = {}
): Promise<SkillDraft | null> {
  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: getDistillSystemPrompt() },
    { role: 'user', content: buildDistillUserPrompt(input) }
  ]

  const result = await client.streamCompletion(messages, [], { model: options.model })
  const content = result.content.trim()
  if (!content) return null

  const draft = parseDistillResponse(content)
  if (!draft) return null

  const name = sanitizeSkillName(draft.name)
  if (name.length < MIN_NAME_LENGTH) return null

  return {
    name,
    description: draft.description.replace(/\s+/g, ' ').trim(),
    body: draft.body.length > MAX_BODY_CHARS ? `${draft.body.slice(0, MAX_BODY_CHARS)}\n[truncated]` : draft.body
  }
}
