import type { ApiChatMessage, AgentRunAnalytics, SkillDraft } from '../../types'

/** Tool results collapse to a preview so the distill prompt stays within budget. */
const MAX_TOOL_RESULT_PREVIEW = 160
const MAX_CONTENT_PREVIEW = 1200
const MAX_USER_MESSAGE_PREVIEW = 800
const MAX_FINAL_CONTENT = 4000

export interface DistillInput {
  /** Full API trajectory from ChatMessage.apiMessages (tool calls included). */
  apiMessages: ApiChatMessage[]
  finalContent: string
  runAnalytics?: AgentRunAnalytics
}

const DISTILL_SYSTEM_PROMPT = `You are an expert at distilling successful AI coding-agent sessions into reusable skill files.

A skill is a markdown file with YAML frontmatter:
---
name: lowercase-with-dashes
description: One sentence: what it teaches and when to use it. Use when <trigger>.
---
Then the body: concise, imperative instructions an agent can follow next time.

Write the skill so a future agent, facing a similar task in a similar codebase, succeeds faster:
- Capture what was NOT obvious: non-standard commands, gotchas, orderings, project conventions.
- Include concrete commands and file paths that were used successfully.
- Reflect repeated or multi-step procedures as short numbered steps.
- Do not narrate the session. Write instructions, not a story.
- 15-40 lines is ideal. Never invent steps that were not part of the session.

Respond with ONLY the skill file content (frontmatter + body). No commentary.`

export function getDistillSystemPrompt(): string {
  return DISTILL_SYSTEM_PROMPT
}

function preview(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}… [+${trimmed.length - max} chars]`
}

function formatToolCalls(calls: NonNullable<ApiChatMessage['tool_calls']>): string {
  return calls
    .map((call) => {
      let args = call.function.arguments
      try {
        const parsed = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
        args = Object.entries(parsed)
          .map(([key, value]) => `${key}=${preview(String(value), 120)}`)
          .join(', ')
      } catch {
        args = preview(args, 160)
      }
      return `  - tool ${call.function.name}(${args})`
    })
    .join('\n')
}

export function buildDistillUserPrompt(input: DistillInput): string {
  const lines: string[] = []

  if (input.runAnalytics) {
    const a = input.runAnalytics
    lines.push(
      `Run summary: mode=${a.mode}, model=${a.model}, iterations=${a.iterations}, status=${a.status}`
    )
    const successfulTools = a.toolCalls.filter((c) => c.outcome === 'success')
    if (successfulTools.length > 0) {
      lines.push(
        `Tools used successfully: ${Array.from(new Set(successfulTools.map((c) => c.name))).join(', ')}`
      )
    }
  }

  lines.push('Original task and session trajectory:', '---')

  for (const message of input.apiMessages) {
    if (message.role === 'user') {
      lines.push(`[user] ${preview(message.content ?? '', MAX_USER_MESSAGE_PREVIEW)}`)
    } else if (message.role === 'assistant') {
      if (message.tool_calls?.length) {
        if (message.content) {
          lines.push(`[assistant] ${preview(message.content, MAX_CONTENT_PREVIEW)}`)
        }
        lines.push(formatToolCalls(message.tool_calls))
      } else if (message.content) {
        lines.push(`[assistant] ${preview(message.content, MAX_CONTENT_PREVIEW)}`)
      }
    } else if (message.role === 'tool') {
      lines.push(`  → result: ${preview(message.content ?? '', MAX_TOOL_RESULT_PREVIEW)}`)
    }
  }

  lines.push('---')
  lines.push(`Final answer to the user: ${preview(input.finalContent, MAX_FINAL_CONTENT)}`)
  lines.push('')
  lines.push(
    'Distill this session into one reusable skill. Respond with only the SKILL.md content.'
  )

  return lines.join('\n')
}

export function parseDistillResponse(text: string): SkillDraft | null {
  const trimmed = text.trim()

  // Strip a wrapping markdown code fence if the model added one.
  const fenceMatch = /^```(?:markdown|md)?\r?\n([\s\S]*?)\r?\n```$/.exec(trimmed)
  const content = fenceMatch ? fenceMatch[1].trim() : trimmed

  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content)
  if (!frontmatter) return null

  const fields: Record<string, string> = {}
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key) fields[key] = value
  }

  const name = fields.name?.trim() ?? ''
  const description = fields.description?.trim() ?? ''
  const body = frontmatter[2].trim()

  if (!name || !description || !body) return null

  return { name, description, body }
}
