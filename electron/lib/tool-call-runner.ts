import type { ChatCompletionMessage, ToolCall } from '../services/openrouter'
import type { ChatMode, TimelineItem, ToolCallInfo, ToolValidationIssue } from '../types'
import { buildExecutionWaves } from './tool-execution-plan'
import {
  classifyToolResult,
  validateToolArguments,
  type ToolCallOutcome
} from '../services/tool-analytics'

const MUTATING_TOOLS = new Set(['write_file', 'search_replace', 'run_terminal'])

export interface ToolCallAnalyticsRecord {
  toolCallId: string
  iteration: number
  name: string
  argumentsRaw: string
  argumentsParsed: Record<string, unknown> | null
  durationMs: number
  outcome: ToolCallOutcome
  issues: ToolValidationIssue[]
  result: string
}

export interface ProcessToolCallsOptions {
  toolCalls: ToolCall[]
  mode: ChatMode
  cwd: string
  iteration: number
  timeline: TimelineItem[]
  messages: ChatCompletionMessage[]
  onToolStart: (toolCall: ToolCallInfo) => void
  onToolDone: (toolCall: ToolCallInfo) => void
  onRecordAnalytics: (record: ToolCallAnalyticsRecord) => void
  requestApproval: (call: ToolCall) => Promise<boolean>
  requiresApproval?: (name: string) => boolean
  executeTool: (call: ToolCall) => Promise<string>
  onExecuteSuccess?: (call: ToolCall, toolInfo: ToolCallInfo) => Promise<void>
}

interface PreparedCall {
  call: ToolCall
  toolInfo: ToolCallInfo
  startedAt: number
  argsValidation: ReturnType<typeof validateToolArguments>
  approved: boolean
}

interface ExecutionResult {
  toolResult: string
  outcome: ToolCallOutcome
  issues: ToolValidationIssue[]
}

export async function processToolCallsBatch(options: ProcessToolCallsOptions): Promise<void> {
  const {
    toolCalls,
    mode,
    cwd,
    iteration,
    timeline,
    messages,
    onToolStart,
    onToolDone,
    onRecordAnalytics,
    requestApproval,
    requiresApproval = (name) => MUTATING_TOOLS.has(name),
    executeTool,
    onExecuteSuccess
  } = options

  const prepared: PreparedCall[] = toolCalls.map((call) => {
    const toolInfo: ToolCallInfo = {
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
      status: 'running'
    }
    onToolStart(toolInfo)
    return {
      call,
      toolInfo,
      startedAt: Date.now(),
      argsValidation: validateToolArguments(call.function.name, call.function.arguments, mode),
      approved: false
    }
  })

  for (const item of prepared) {
    if (!item.argsValidation.ok) continue
    if (requiresApproval(item.call.function.name)) {
      item.approved = await requestApproval(item.call)
    } else {
      item.approved = true
    }
  }

  const executionResults = new Map<string, ExecutionResult>()
  const waves = buildExecutionWaves(toolCalls, cwd)

  for (const wave of waves) {
    await Promise.all(
      wave.map(async (call) => {
        const item = prepared.find((p) => p.call.id === call.id)
        if (!item) return

        const { argsValidation, toolInfo } = item
        let issues = [...argsValidation.issues]
        let toolResult: string
        let outcome: ToolCallOutcome

        if (!argsValidation.ok) {
          toolResult = `Error: ${argsValidation.errorMessage}`
          toolInfo.status = 'error'
          toolInfo.result = toolResult
          outcome = 'invalid_args'
        } else if (!item.approved) {
          toolResult = 'Error: User rejected this action.'
          toolInfo.status = 'error'
          toolInfo.result = toolResult
          outcome = 'error'
          issues = [...issues, 'execution_error']
        } else {
          try {
            toolResult = await executeTool(call)
            const classified = classifyToolResult(call.function.name, toolResult)
            outcome = classified.outcome
            issues = [...issues, ...classified.issues]
            toolInfo.status = outcome === 'success' ? 'done' : 'error'
            toolInfo.result = toolResult
            if (outcome === 'success' && onExecuteSuccess) {
              await onExecuteSuccess(call, toolInfo)
            }
          } catch (err) {
            toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`
            toolInfo.status = 'error'
            toolInfo.result = toolResult
            outcome = 'error'
            issues = [...issues, 'execution_error']
          }
        }

        executionResults.set(call.id, { toolResult, outcome, issues })
      })
    )
  }

  for (const item of prepared) {
    const stored = executionResults.get(item.call.id)
    const toolResult =
      stored?.toolResult ??
      `Error: ${item.argsValidation.errorMessage ?? 'Tool call was not executed'}`
    const outcome = stored?.outcome ?? (item.argsValidation.ok ? 'error' : 'invalid_args')
    const issues = stored?.issues ?? [...item.argsValidation.issues]

    onRecordAnalytics({
      toolCallId: item.call.id,
      iteration,
      name: item.call.function.name,
      argumentsRaw: item.call.function.arguments,
      argumentsParsed: item.argsValidation.parsed,
      durationMs: Date.now() - item.startedAt,
      outcome,
      issues,
      result: toolResult
    })

    onToolDone(item.toolInfo)
    timeline.push({
      id: item.call.id,
      type: 'tool',
      toolCall: { ...item.toolInfo }
    })

    messages.push({
      role: 'tool',
      tool_call_id: item.call.id,
      name: item.call.function.name,
      content: toolResult
    })
  }
}
