import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { ChatMode, ToolCallAnalytics, AgentRunAnalytics, ToolValidationIssue } from '../types'

const TOOLS_KNOWN: Record<string, true> = {
  read_file: true,
  write_file: true,
  search_replace: true,
  list_directory: true,
  search_files: true,
  run_terminal: true,
  web_search: true,
  get_open_files: true
}

const REQUIRED_ARGS: Record<string, string[]> = {
  read_file: ['path'],
  write_file: ['path', 'content'],
  search_replace: ['path', 'old_string', 'new_string'],
  list_directory: [],
  search_files: ['query'],
  run_terminal: ['command'],
  web_search: ['query'],
  get_open_files: []
}

export type ToolCallOutcome = 'success' | 'error' | 'invalid_args'

export interface ToolArgsValidation {
  ok: boolean
  parsed: Record<string, unknown> | null
  issues: ToolValidationIssue[]
  errorMessage?: string
}

export function validateToolArguments(
  toolName: string,
  argsRaw: string,
  mode: ChatMode
): ToolArgsValidation {
  const issues: ToolValidationIssue[] = []
  let parsed: Record<string, unknown> | null = null

  try {
    parsed = JSON.parse(argsRaw || '{}') as Record<string, unknown>
  } catch {
    return {
      ok: false,
      parsed: null,
      issues: ['invalid_arguments_json'],
      errorMessage: 'Tool arguments are not valid JSON'
    }
  }

  if (!Object.keys(TOOLS_KNOWN).includes(toolName)) {
    issues.push('unknown_tool')
  }

  if (mode === 'planner' && ['write_file', 'search_replace', 'run_terminal'].includes(toolName)) {
    issues.push('tool_not_allowed_in_mode')
  }
  if (mode === 'ask') {
    issues.push('tool_not_allowed_in_mode')
  }

  const required = REQUIRED_ARGS[toolName] ?? []
  for (const key of required) {
    const value = parsed[key]
    if (value === undefined || value === null || value === '') {
      issues.push('missing_required_argument')
      break
    }
  }

  if (toolName === 'read_file' || toolName === 'write_file' || toolName === 'search_replace') {
    if (!String(parsed.path ?? '').trim()) issues.push('empty_path')
  }
  if (toolName === 'search_files' || toolName === 'web_search') {
    if (!String(parsed.query ?? '').trim()) issues.push('empty_query')
  }
  if (toolName === 'run_terminal') {
    if (!String(parsed.command ?? '').trim()) issues.push('empty_command')
  }

  const blocking = issues.filter(
    (i) =>
      i !== 'no_results' &&
      i !== 'search_replace_identical'
  )

  if (blocking.length > 0) {
    return {
      ok: false,
      parsed,
      issues,
      errorMessage: `Invalid tool call: ${blocking.join(', ')}`
    }
  }

  return { ok: true, parsed, issues }
}

export function classifyToolResult(
  toolName: string,
  result: string
): { outcome: ToolCallOutcome; issues: ToolValidationIssue[] } {
  const issues: ToolValidationIssue[] = []

  if (result.startsWith('Error:')) {
    const message = result.toLowerCase()
    if (message.includes('old_string not found')) issues.push('search_replace_not_found')
    else if (message.includes('matched') && message.includes('times')) {
      issues.push('search_replace_ambiguous')
    } else if (message.includes('identical')) issues.push('search_replace_identical')
    else if (message.includes('blocked potentially destructive')) issues.push('terminal_blocked')
    else if (message.includes('not available in')) issues.push('tool_not_allowed_in_mode')
    else if (message.includes('invalid tool call')) issues.push('missing_required_argument')
    else issues.push('execution_error')

    return { outcome: 'error', issues }
  }

  if (toolName === 'search_files' && result === 'No matches found') {
    issues.push('no_results')
  }

  return { outcome: 'success', issues }
}

function buildSummary(toolCalls: ToolCallAnalytics[]): AgentRunAnalytics['summary'] {
  const summary: AgentRunAnalytics['summary'] = {
    totalTools: toolCalls.length,
    success: 0,
    errors: 0,
    invalidArgs: 0,
    issueCounts: {},
    byTool: {}
  }

  for (const call of toolCalls) {
    if (call.outcome === 'success') summary.success++
    else if (call.outcome === 'invalid_args') summary.invalidArgs++
    else summary.errors++

    if (!summary.byTool[call.name]) {
      summary.byTool[call.name] = { total: 0, success: 0, error: 0 }
    }
    const bucket = summary.byTool[call.name]
    bucket.total++
    if (call.outcome === 'success') bucket.success++
    else bucket.error++

    for (const issue of call.issues) {
      summary.issueCounts[issue] = (summary.issueCounts[issue] ?? 0) + 1
    }
  }

  return summary
}

export class ToolAnalyticsCollector {
  private readonly runId: string
  private readonly startedAt: string
  private readonly toolCalls: ToolCallAnalytics[] = []

  constructor(
    private readonly mode: ChatMode,
    private readonly model: string,
    private readonly userMessage: string,
    private readonly maxIterations: number
  ) {
    this.runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.startedAt = new Date().toISOString()
  }

  recordToolCall(input: {
    toolCallId: string
    iteration: number
    name: string
    argumentsRaw: string
    argumentsParsed: Record<string, unknown> | null
    durationMs: number
    outcome: ToolCallOutcome
    issues: ToolValidationIssue[]
    result: string
  }): ToolCallAnalytics {
    const record: ToolCallAnalytics = {
      id: `ta-${input.toolCallId}`,
      toolCallId: input.toolCallId,
      iteration: input.iteration,
      name: input.name,
      argumentsRaw: input.argumentsRaw,
      argumentsParsed: input.argumentsParsed,
      startedAt: new Date(Date.now() - input.durationMs).toISOString(),
      durationMs: input.durationMs,
      outcome: input.outcome,
      issues: input.issues,
      resultPreview: input.result.slice(0, 500),
      resultLength: input.result.length
    }
    this.toolCalls.push(record)
    return record
  }

  finish(
    status: AgentRunAnalytics['status'],
    iterations: number,
    error?: string
  ): AgentRunAnalytics {
    return {
      runId: this.runId,
      mode: this.mode,
      model: this.model,
      userMessagePreview: this.userMessage.slice(0, 200),
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      status,
      iterations,
      maxIterations: this.maxIterations,
      error,
      toolCalls: [...this.toolCalls],
      summary: buildSummary(this.toolCalls)
    }
  }
}

const recentRuns: AgentRunAnalytics[] = []
const MAX_RECENT_RUNS = 50

export function getRecentAnalyticsRuns(limit = 20): AgentRunAnalytics[] {
  return recentRuns.slice(-limit).reverse()
}

export async function persistRunAnalytics(run: AgentRunAnalytics): Promise<void> {
  recentRuns.push(run)
  if (recentRuns.length > MAX_RECENT_RUNS) {
    recentRuns.splice(0, recentRuns.length - MAX_RECENT_RUNS)
  }

  try {
    const logDir = join(app.getPath('userData'), 'logs')
    await mkdir(logDir, { recursive: true })
    await appendFile(join(logDir, 'tool-analytics.jsonl'), `${JSON.stringify(run)}\n`, 'utf-8')
  } catch (err) {
    console.error('[ToolAnalytics] Failed to persist run:', err)
  }
}

export function getAnalyticsLogDir(): string {
  return join(app.getPath('userData'), 'logs')
}
