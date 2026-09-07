import type { AgentContext, ChatMode, ChatMessage, ApiChatMessage } from '../types'
import type { ToolDefinition } from './openrouter'
import type { McpManager } from './mcp/mcp-manager'
import { isMcpQualifiedToolName } from './mcp/mcp-tool-mapper'
import { estimateTokens, trimToTokenBudget, DEFAULT_CONTEXT_BUDGET } from '../lib/tokens'

const READ_ONLY_TOOL_NAMES = new Set([
  'read_file',
  'read_files',
  'list_directory',
  'search_files',
  'grep_workspace',
  'codebase_search',
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
      return 25
    case 'agent':
    default:
      return 50
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

export function isToolAllowedInMode(
  toolName: string,
  mode: ChatMode,
  mcpManager?: McpManager
): boolean {
  if (isMcpQualifiedToolName(toolName)) {
    return mcpManager?.isToolAllowedInMode(toolName, mode) ?? false
  }
  if (mode === 'agent') return true
  if (mode === 'ask') return false
  return READ_ONLY_TOOL_NAMES.has(toolName)
}

export function formatMcpServersSection(
  servers: Array<{ id: string; name: string; toolCount: number }>
): string {
  if (servers.length === 0) return ''

  const lines = servers.map(
    (s) => `- ${s.name} (${s.toolCount} tools) — prefer built-in grep_workspace/codebase_search over MCP filesystem duplicates`
  )
  return `Connected MCP servers:
${lines.join('\n')}

Use MCP tools when they provide capabilities not covered by built-in tools.`
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

const EXPLORATION_WORKFLOW = `Code exploration workflow:
1. codebase_search (mode hybrid) — find relevant files, symbols, and semantic matches first
2. grep_workspace — regex search across the workspace (class names, string literals, imports); use instead of shell grep
3. Gather a file scope from search hits — list the paths you actually need; do NOT read files one-by-one while exploring
4. read_files — read the whole scope in one call (1–10 paths). Even a single file: read_files with paths: ["that/file"]
5. get_open_files — check editor tabs before re-reading the same paths
6. list_directory — only if the index is not ready or you need one folder's layout; do not walk the repo tree
7. search_files is deprecated — use grep_workspace or codebase_search
8. read_file is deprecated — use read_files (works for one path too)

Anti-patterns:
- Do NOT call read_file / read_files repeatedly while still discovering — search first, batch-read once
- Do NOT use run_terminal for grep, ripgrep, find, Select-String, findstr, or scanning source files — use grep_workspace or codebase_search
- run_terminal is for builds, tests, dev servers, and package managers — not code navigation`

const EDITING_WORKFLOW = `Editing workflow:
- Plan all file changes first (read_files, then decide every patch)
- Emit every search_replace / write_file for the task in ONE assistant response as multiple tool_calls — not one file per turn
- Keep multiple edits to the same file in order (first call before second)
- After edits, one short summary to the user — do not re-read files you just wrote unless verification failed`

const PROJECT_MEMORY_GUIDELINES = `Guidelines for memory:
- Prefer existing memory over re-discovering conventions
- Use update_project_memory to persist important decisions, architecture notes, and recurring pitfalls
- Do not store secrets, API keys, or tokens in memory`

function formatProjectMemorySection(projectMemory?: string): string {
  const body = projectMemory?.trim() || 'No project memory yet.'
  return `Project memory (workspace-specific; treat as authoritative context):
${body}

${PROJECT_MEMORY_GUIDELINES}`
}

export function buildSystemPrompt(
  context: AgentContext,
  mcpServers: Array<{ id: string; name: string; toolCount: number }> = []
): string {
  const openFilesList = formatOpenFiles(context)
  const workspaceLine = context.workingDirectory
    ? `Working directory: ${context.workingDirectory}`
    : 'Working directory: not set'
  const mcpSection = formatMcpServersSection(mcpServers)

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

Code exploration workflow:
1. codebase_search (mode hybrid) — find where logic lives; symbol for definitions; text for regex
2. grep_workspace — regex search when you need exact patterns (CSS classes, config keys)
3. Gather file scope from hits — decide which paths matter for the plan; do not read while still searching
4. read_files — one batch call with every path you need (1–10). Single file: still use read_files
5. list_directory — only if the index is empty or you need folder structure; never scan the repo file-by-file
6. search_files / read_file are deprecated — use grep_workspace and read_files

Anti-patterns:
- Do NOT use run_terminal for searching or grepping source (blocked in agent mode anyway)
- Do NOT read files one-by-one across exploration — search, scope, then read_files once

Guidelines:
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

${formatProjectMemorySection(context.projectMemory)}

${EXPLORATION_WORKFLOW}

${EDITING_WORKFLOW}
${mcpSection ? `\n${mcpSection}\n` : ''}
Guidelines:
- Read target files (via read_files) before editing; search snippets are not enough for search_replace
- Prefer search_replace for editing existing files; use write_file for new files or full rewrites
- Avoid write_file with very large content in one call — split edits with search_replace
- Prefer small, focused changes
- Explain what you are doing briefly
- Use paths relative to the working directory
- Respond in the same language the user writes in`
  }
}
