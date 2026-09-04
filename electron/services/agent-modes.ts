import type { AgentContext, ChatMode, ChatMessage, ApiChatMessage } from '../types'
import type { ToolDefinition } from './openrouter'
import { estimateTokens, trimToTokenBudget, DEFAULT_CONTEXT_BUDGET } from '../lib/tokens'

const READ_ONLY_TOOL_NAMES = new Set([
  'read_file',
  'list_directory',
  'search_files',
  'get_open_files',
  'web_search'
])

export function getToolsForMode(mode: ChatMode, allTools: ToolDefinition[]): ToolDefinition[] {
  switch (mode) {
    case 'ask':
      return []
    case 'planner':
      return allTools.filter((t) => READ_ONLY_TOOL_NAMES.has(t.function.name))
    case 'agent':
    default:
      return allTools
  }
}

export function getMaxIterations(mode: ChatMode): number {
  switch (mode) {
    case 'ask':
      return 1
    case 'planner':
      return 15
    case 'agent':
    default:
      return 30
  }
}

export function modeRequiresWorkspace(mode: ChatMode): boolean {
  return mode === 'agent' || mode === 'planner'
}

export function filterHistoryForApi(history: ChatMessage[], mode: ChatMode): ChatMessage[] {
  return history
    .filter((m) => {
      if (m.mode && m.mode !== mode) return false
      if (m.role !== 'user' && m.role !== 'assistant') return false
      if (m.isError) return false
      if (!m.content?.trim()) return false
      if (
        m.role === 'assistant' &&
        (m.content.startsWith('Error:') || m.content.startsWith('⚠️'))
      ) {
        return false
      }
      return true
    })
    .slice(-30)
}

export function isToolAllowedInMode(toolName: string, mode: ChatMode): boolean {
  if (mode === 'agent') return true
  if (mode === 'ask') return false
  return READ_ONLY_TOOL_NAMES.has(toolName)
}

function formatOpenFiles(context: AgentContext): string {
  if (context.openFiles.length === 0) return 'None'
  return context.openFiles.map((f) => `- ${f.path} (${f.language})`).join('\n')
}

function formatOpenFilesWithContent(context: AgentContext, perFileLimit = 4000, totalLimit = 12000): string {
  if (context.openFiles.length === 0) return 'None'

  if (context.mode === 'ask') {
    return context.openFiles.map((f) => `- ${f.path} (${f.language})`).join('\n')
  }

  const parts: string[] = []
  let used = 0

  for (const f of context.openFiles) {
    const slice = f.content.slice(0, perFileLimit)
    const block = `=== ${f.path} (${f.language}) ===\n${slice}`
    if (used + block.length > totalLimit) break
    parts.push(block)
    used += block.length
  }

  return parts.join('\n\n') || 'None'
}

export function expandHistoryForApi(
  history: ChatMessage[],
  mode: ChatMode,
  budget = DEFAULT_CONTEXT_BUDGET
): ApiChatMessage[] {
  const filtered = filterHistoryForApi(history, mode)
  const expanded: ApiChatMessage[] = []
  let tokenCount = 0

  for (const message of filtered) {
    if (message.apiMessages && message.apiMessages.length > 0) {
      for (const apiMsg of message.apiMessages) {
        const msgTokens = estimateTokens(apiMsg.content ?? '') +
          (apiMsg.tool_calls ? estimateTokens(JSON.stringify(apiMsg.tool_calls)) : 0)
        if (tokenCount + msgTokens > budget) break
        expanded.push({
          ...apiMsg,
          content: apiMsg.content
            ? trimToTokenBudget(apiMsg.content, Math.min(8000, budget - tokenCount))
            : apiMsg.content
        })
        tokenCount += msgTokens
      }
      continue
    }

    const msgTokens = estimateTokens(message.content)
    if (tokenCount + msgTokens > budget) break
    expanded.push({
      role: message.role as 'user' | 'assistant',
      content: message.content
    })
    tokenCount += msgTokens
  }

  return expanded
}

export function buildSystemPrompt(context: AgentContext): string {
  const openFilesList = formatOpenFiles(context)
  const workspaceLine = context.workingDirectory
    ? `Working directory: ${context.workingDirectory}`
    : 'Working directory: not set'

  switch (context.mode) {
    case 'ask':
      return `You are a helpful programming assistant in ASK mode inside a desktop IDE.
You answer questions clearly and concisely. You do NOT have tools and cannot read or modify files directly.

${workspaceLine}
Open files in editor:
${formatOpenFiles(context)}

File contents (if any open in editor):
${formatOpenFilesWithContent(context)}

Guidelines:
- Answer questions, explain concepts, review ideas, and suggest approaches
- If open file contents are relevant, use the context provided above
- Do not claim you ran commands or changed files
- Prefer practical, accurate answers with code examples when useful
- Respond in the same language the user writes in`

    case 'planner':
      return `You are a technical planning assistant in PLANNER mode inside a desktop IDE.
Your job is to explore the codebase (read-only) and produce clear, actionable plans. You must NOT modify files or run shell commands.

${workspaceLine}
Open files:
${openFilesList}

Guidelines:
- Use read/search tools to understand the project before planning
- Output structured plans in Markdown with sections like: Goal, Assumptions, Steps, Files to touch, Risks, Testing
- Number steps in execution order; keep steps small and verifiable
- Never call write_file, search_replace, or run_terminal — planning only
- Respond in the same language the user writes in`

    case 'agent':
    default:
      return `${context.customSystemPrompt ? `${context.customSystemPrompt}\n\n` : ''}You are an expert AI coding agent integrated into a desktop IDE.
You have tools for reading/writing files, searching the codebase, running terminal commands, and web search.

${workspaceLine}
Open files:
${openFilesList}

Guidelines:
- Use tools proactively to gather information before acting
- Read files before editing them
- Prefer search_replace for editing existing files; use write_file for new files or full rewrites
- Avoid write_file with very large content in one call — split edits with search_replace
- Prefer small, focused changes
- Explain what you are doing briefly
- Use paths relative to the working directory
- Respond in the same language the user writes in`
  }
}
