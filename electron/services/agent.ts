import { join, isAbsolute } from 'path'
import type { AgentContext, AgentEvent, ChatMode, ToolCallInfo, TimelineItem, AgentRunAnalytics, ApiChatMessage, ToolApprovalRequest } from '../types'
import type { FileSystemService } from './filesystem'
import type { TerminalService } from './terminal'
import type { WebSearchService } from './websearch'
import {
  OpenRouterClient,
  type ChatCompletionMessage,
  type ToolCall,
  type ToolDefinition
} from './openrouter'
import {
  assertAllowedWorkspace,
  assertPathNotInAgentApp,
  assertSafeTerminalCommand,
  AGENT_APP_WORKSPACE_ERROR
} from './workspace-safety'
import {
  buildSystemPrompt,
  getMaxIterations,
  getToolsForMode,
  isToolAllowedInMode,
  modeRequiresWorkspace,
  expandHistoryForApi
} from './agent-modes'
import { simpleLineDiff } from '../lib/diff'
import {
  ToolAnalyticsCollector,
  validateToolArguments,
  classifyToolResult,
  persistRunAnalytics,
  type ToolCallOutcome
} from './tool-analytics'

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Create a new file or fully overwrite an existing file. For partial edits, use search_replace instead.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'File content' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_replace',
      description:
        'Replace an exact text fragment in an existing file. Prefer this for small edits. old_string must match exactly (whitespace, indentation). Must be unique unless replace_all is true.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          old_string: { type: 'string', description: 'Exact text to find in the file' },
          new_string: { type: 'string', description: 'Replacement text' },
          replace_all: {
            type: 'boolean',
            description: 'Replace every occurrence (default false — requires a unique match)'
          }
        },
        required: ['path', 'old_string', 'new_string']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and directories in a given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for text in project files (grep-like)',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (regex supported)' },
          root: { type: 'string', description: 'Root directory to search in' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_terminal',
      description: 'Execute a shell command in the working directory',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_open_files',
      description: 'Get the list of currently open files in the editor with their contents',
      parameters: { type: 'object', properties: {} }
    }
  }
]

const MUTATING_TOOLS = new Set(['write_file', 'search_replace', 'run_terminal'])

export class AgentService {
  private abortController: AbortController | null = null
  private running = false
  private approvalResolvers = new Map<string, (approved: boolean) => void>()
  private sessionAutoApproveWrites = false
  private sessionAutoApproveTerminal = false

  constructor(
    private openRouter: OpenRouterClient,
    private fs: FileSystemService,
    private terminal: TerminalService,
    private webSearch: WebSearchService
  ) {}

  get isRunning(): boolean {
    return this.running
  }

  resolveApproval(approvalId: string, approved: boolean): void {
    const resolver = this.approvalResolvers.get(approvalId)
    if (resolver) {
      resolver(approved)
      this.approvalResolvers.delete(approvalId)
    }
    if (approved) {
      // session auto-approve handled per-tool in waitForApproval
    }
  }

  setSessionAutoApprove(toolName: string): void {
    if (toolName === 'run_terminal') this.sessionAutoApproveTerminal = true
    else this.sessionAutoApproveWrites = true
  }

  abort(): void {
    this.abortController?.abort()
  }

  async run(
    userMessage: string,
    context: AgentContext,
    emit: (event: AgentEvent) => void
  ): Promise<void> {
    const mode: ChatMode = context.mode ?? 'agent'

    if (this.running) {
      emit({ type: 'error', error: 'Agent is already running. Wait or abort the current run.' })
      return
    }

    if (!this.openRouter.hasApiKey()) {
      emit({
        type: 'error',
        error: 'OpenRouter API key is not set. Open Settings and add your key.'
      })
      return
    }

    if (modeRequiresWorkspace(mode) && !context.workingDirectory) {
      emit({
        type: 'error',
        error: 'No workspace folder open. Open a project folder in Explorer (not the agent app folder).'
      })
      return
    }

    if (modeRequiresWorkspace(mode) && context.workingDirectory) {
      try {
        assertAllowedWorkspace(context.workingDirectory)
      } catch (err) {
        emit({
          type: 'error',
          error: err instanceof Error ? err.message : AGENT_APP_WORKSPACE_ERROR
        })
        return
      }
    }

    this.abortController = new AbortController()
    const signal = this.abortController.signal
    this.running = true

    const tools = getToolsForMode(mode, TOOLS)
    const maxIterations = getMaxIterations(mode)
    const expandedHistory = expandHistoryForApi(context.history, mode)
    const analytics = new ToolAnalyticsCollector(
      mode,
      context.model ?? 'unknown',
      userMessage,
      maxIterations
    )

    let iterations = 0
    let analyticsClosed = false

    const finishRun = async (
      status: 'completed' | 'error' | 'aborted' | 'max_iterations',
      iterationCount: number,
      error?: string
    ): Promise<AgentRunAnalytics> => {
      const run = analytics.finish(status, iterationCount, error)
      analyticsClosed = true
      await persistRunAnalytics(run)
      emit({ type: 'run_analytics', analytics: run })
      return run
    }

    const systemPrompt = buildSystemPrompt({ ...context, mode })
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: systemPrompt },
      ...expandedHistory.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'tool',
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {})
      }))
    ]

    const userContent =
      context.images && context.images.length > 0
        ? ([
            { type: 'text' as const, text: userMessage },
            ...context.images.map((url) => ({
              type: 'image_url' as const,
              image_url: { url }
            }))
          ] as ChatCompletionMessage['content'])
        : userMessage

    messages.push({ role: 'user', content: userContent })
    const runApiStartIndex = messages.length

    const emitInterrupted = async (
      error: string,
      status: 'error' | 'max_iterations' | 'aborted',
      timeline: TimelineItem[]
    ): Promise<void> => {
      const run = await finishRun(status, iterations, error)
      const errorNote = `⚠️ ${error}`
      const timelineCopy = [...timeline]
      timelineCopy.push({
        id: `error-${Date.now()}`,
        type: 'text',
        content: errorNote
      })
      const apiMessages: ApiChatMessage[] = messages
        .slice(runApiStartIndex)
        .map((m) => ({
          role: m.role as ApiChatMessage['role'],
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          tool_calls: m.tool_calls,
          tool_call_id: m.tool_call_id,
          name: m.name
        }))

      emit({
        type: 'done',
        message: {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: errorNote,
          timeline: timelineCopy,
          apiMessages,
          interrupted: true,
          isError: true,
          runAnalytics: run
        }
      })
    }

    const timeline: TimelineItem[] = []

    try {
      while (iterations < maxIterations) {
        iterations++
        if (signal.aborted) break

        let streamedContent = ''
        let streamedReasoning = ''
        const result = await this.openRouter.streamCompletion(messages, tools, {
          onChunk: (chunk) => {
            streamedContent += chunk
            emit({ type: 'stream', content: chunk })
          },
          onReasoningChunk: (reasoningChunk) => {
            streamedReasoning += reasoningChunk
            emit({ type: 'reasoning_stream', content: reasoningChunk })
          },
          onToolCallProgress: (call) => {
            emit({
              type: 'tool_progress',
              toolCall: {
                id: call.id,
                name: call.function.name || 'preparing',
                arguments: call.function.arguments,
                status: 'running'
              }
            })
          },
          signal,
          model: context.model,
          temperature: context.temperature,
          maxTokens: context.maxTokens
        })

        const iterationReasoning = (result.reasoning || streamedReasoning).trim()
        if (iterationReasoning) {
          timeline.push({
            id: `reasoning-${iterations}-${Date.now()}`,
            type: 'reasoning',
            content: iterationReasoning
          })
        }

        if (result.toolCalls.length > 0) {
          const preToolContent = (result.content || streamedContent).trim()
          if (preToolContent) {
            timeline.push({
              id: `text-${iterations}-pre-${Date.now()}`,
              type: 'text',
              content: preToolContent
            })
          }

          messages.push({
            role: 'assistant',
            content: result.content || null,
            tool_calls: result.toolCalls
          })

          for (const call of result.toolCalls) {
            const toolInfo: ToolCallInfo = {
              id: call.id,
              name: call.function.name,
              arguments: call.function.arguments,
              status: 'running'
            }
            emit({ type: 'tool_start', toolCall: toolInfo })

            const startedAt = Date.now()
            const argsValidation = validateToolArguments(
              call.function.name,
              call.function.arguments,
              mode
            )

            let toolResult: string
            let outcome: ToolCallOutcome
            let issues = [...argsValidation.issues]

            if (!argsValidation.ok) {
              toolResult = `Error: ${argsValidation.errorMessage}`
              toolInfo.status = 'error'
              toolInfo.result = toolResult
              outcome = 'invalid_args'
            } else {
              try {
                const approved = await this.waitForApproval(call, context, emit)
                if (!approved) {
                  toolResult = 'Error: User rejected this action.'
                  toolInfo.status = 'error'
                  toolInfo.result = toolResult
                  outcome = 'error'
                  issues = [...issues, 'execution_error']
                } else {
                  toolResult = await this.executeTool(call, context, mode)
                  const classified = classifyToolResult(call.function.name, toolResult)
                  outcome = classified.outcome
                  issues = [...issues, ...classified.issues]
                  toolInfo.status = outcome === 'success' ? 'done' : 'error'
                  toolInfo.result = toolResult
                }
              } catch (err) {
                toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`
                toolInfo.status = 'error'
                toolInfo.result = toolResult
                outcome = 'error'
                issues = [...issues, 'execution_error']
              }
            }

            analytics.recordToolCall({
              toolCallId: call.id,
              iteration: iterations,
              name: call.function.name,
              argumentsRaw: call.function.arguments,
              argumentsParsed: argsValidation.parsed,
              durationMs: Date.now() - startedAt,
              outcome,
              issues,
              result: toolResult
            })

            emit({ type: 'tool_done', toolCall: toolInfo })
            timeline.push({
              id: call.id,
              type: 'tool',
              toolCall: { ...toolInfo }
            })

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.function.name,
              content: toolResult
            })
          }

          emit({ type: 'stream', content: '' })
          continue
        }

        const finalContent = (result.content || streamedContent).trim()

        if (!finalContent && timeline.length === 0) {
          await finishRun('error', iterations, 'Model returned an empty response.')
          emit({
            type: 'error',
            error: 'Model returned an empty response. Try again or switch model.'
          })
          break
        }

        if (finalContent) {
          timeline.push({
            id: `text-final-${Date.now()}`,
            type: 'text',
            content: finalContent
          })
        }

        const run = await finishRun('completed', iterations)
        const apiMessages: ApiChatMessage[] = messages
          .slice(runApiStartIndex)
          .map((m) => ({
            role: m.role as ApiChatMessage['role'],
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            tool_calls: m.tool_calls,
            tool_call_id: m.tool_call_id,
            name: m.name
          }))

        emit({
          type: 'done',
          message: {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: finalContent,
            timeline: timeline.length > 0 ? [...timeline] : undefined,
            apiMessages,
            runAnalytics: run
          }
        })
        break
      }

      if (!analyticsClosed && signal.aborted) {
        await finishRun('aborted', iterations)
        if (timeline.length > 0) {
          await emitInterrupted('Run aborted.', 'aborted', timeline)
        }
      }

      if (!analyticsClosed && iterations >= maxIterations) {
        const error = `Agent reached the maximum number of tool steps (${maxIterations}).`
        await emitInterrupted(error, 'max_iterations', timeline)
      }
    } catch (err) {
      if (!signal.aborted) {
        const message = err instanceof Error ? err.message : String(err)
        if (!analyticsClosed) await finishRun('error', iterations, message)
        if (timeline.length > 0) {
          await emitInterrupted(message, 'error', timeline)
        } else {
          emit({
            type: 'error',
            error: message
          })
        }
      } else if (!analyticsClosed) {
        await finishRun('aborted', iterations)
        if (timeline.length > 0) {
          await emitInterrupted('Run aborted.', 'aborted', timeline)
        }
      }
    } finally {
      this.running = false
      this.abortController = null
    }
  }

  private async waitForApproval(
    call: ToolCall,
    context: AgentContext,
    emit: (event: AgentEvent) => void
  ): Promise<boolean> {
    if (!MUTATING_TOOLS.has(call.function.name)) return true

    const autoWrites = context.autoApproveWrites || this.sessionAutoApproveWrites
    const autoTerminal = context.autoApproveTerminal || this.sessionAutoApproveTerminal

    if (call.function.name === 'run_terminal' && autoTerminal) return true
    if (
      (call.function.name === 'write_file' || call.function.name === 'search_replace') &&
      autoWrites
    ) {
      return true
    }

    const args = JSON.parse(call.function.arguments || '{}') as Record<string, string>
    let preview = ''
    let diff = ''

    if (call.function.name === 'write_file') {
      preview = `Write ${args.path ?? ''} (${(args.content ?? '').length} chars)`
    } else if (call.function.name === 'search_replace') {
      preview = `Patch ${args.path ?? ''}`
      try {
        const path = this.resolvePath(String(args.path ?? ''), context.workingDirectory)
        const current = await this.fs.readFile(path)
        const next = current.replace(
          String(args.old_string ?? ''),
          String(args.new_string ?? '')
        )
        diff = simpleLineDiff(current, next)
      } catch {
        diff = `-${args.old_string}\n+${args.new_string}`
      }
    } else if (call.function.name === 'run_terminal') {
      preview = `Run: ${args.command ?? ''}`
    }

    const approvalId = `approval-${call.id}`
    const request: ToolApprovalRequest = {
      id: approvalId,
      toolCallId: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
      preview,
      diff
    }

    emit({ type: 'approval_request', approval: request })

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        this.approvalResolvers.delete(approvalId)
        resolve(false)
      }, 5 * 60 * 1000)

      this.approvalResolvers.set(approvalId, (approved) => {
        clearTimeout(timeout)
        resolve(approved)
      })
    })
  }

  private async executeTool(
    call: ToolCall,
    context: AgentContext,
    mode: ChatMode
  ): Promise<string> {
    if (!isToolAllowedInMode(call.function.name, mode)) {
      return `Error: Tool "${call.function.name}" is not available in ${mode} mode.`
    }

    const args = JSON.parse(call.function.arguments || '{}') as Record<
      string,
      string | boolean | undefined
    >
    const cwd = context.workingDirectory

    switch (call.function.name) {
      case 'read_file': {
        const path = this.resolvePath(String(args.path ?? ''), cwd)
        assertPathNotInAgentApp(path)
        const content = await this.fs.readFile(path)
        return content.slice(0, 50000)
      }
      case 'write_file': {
        const path = this.resolvePath(String(args.path ?? ''), cwd)
        assertPathNotInAgentApp(path)
        await this.fs.writeFile(path, String(args.content ?? ''))
        return `Successfully wrote ${String(args.content ?? '').length} characters to ${path}`
      }
      case 'search_replace': {
        const path = this.resolvePath(String(args.path ?? ''), cwd)
        assertPathNotInAgentApp(path)
        const replaceAll = args.replace_all === true || args.replace_all === 'true'
        const result = await this.fs.searchReplace(
          path,
          String(args.old_string ?? ''),
          String(args.new_string ?? ''),
          replaceAll
        )
        return `Successfully replaced ${result.replacements} occurrence(s) in ${path}`
      }
      case 'list_directory': {
        const path = this.resolvePath(String(args.path || cwd), cwd)
        assertPathNotInAgentApp(path)
        const entries = await this.fs.listDir(path)
        return entries.map((e) => `${e.isDirectory ? '[dir]' : '[file]'} ${e.name}`).join('\n')
      }
      case 'search_files': {
        const root = args.root ? this.resolvePath(String(args.root), cwd) : cwd
        assertPathNotInAgentApp(root)
        const results = await this.fs.searchFiles(String(args.query ?? ''), root)
        if (results.length === 0) return 'No matches found'
        return results.map((r) => `${r.file}:${r.line}: ${r.content}`).join('\n')
      }
      case 'run_terminal': {
        if (!cwd) return 'Error: No working directory set'
        assertSafeTerminalCommand(String(args.command ?? ''))
        return await this.terminal.runCommand(String(args.command ?? ''), cwd)
      }
      case 'web_search': {
        const results = await this.webSearch.search(String(args.query ?? ''))
        return results.map((r) => `**${r.title}**\n${r.url}\n${r.snippet}`).join('\n\n')
      }
      case 'get_open_files': {
        if (context.openFiles.length === 0) return 'No files are currently open'
        return context.openFiles
          .map((f) => `=== ${f.path} ===\n${f.content.slice(0, 10000)}`)
          .join('\n\n')
      }
      default:
        return `Unknown tool: ${call.function.name}`
    }
  }

  private resolvePath(filePath: string, cwd: string): string {
    if (!filePath) return cwd
    return isAbsolute(filePath) ? filePath : join(cwd, filePath)
  }
}
