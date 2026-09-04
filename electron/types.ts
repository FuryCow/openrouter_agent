export type ChatMode = 'agent' | 'ask' | 'planner'

export interface AppSettings {
  apiKey: string
  model: string
  workingDirectory: string
  temperature?: number
  maxTokens?: number
  modelsByMode?: Partial<Record<ChatMode, string>>
  customSystemPrompt?: string
  autoApproveWrites?: boolean
  autoApproveTerminal?: boolean
  searchApiKey?: string
  searchProvider?: 'duckduckgo' | 'tavily' | 'brave'
}

export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface SearchResult {
  file: string
  line: number
  content: string
}

export interface OpenFileContext {
  path: string
  content: string
  language: string
}

export interface AgentContext {
  mode: ChatMode
  workingDirectory: string
  openFiles: OpenFileContext[]
  history: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  images?: string[]
  customSystemPrompt?: string
  autoApproveWrites?: boolean
  autoApproveTerminal?: boolean
}

export interface ToolCallInfo {
  id: string
  name: string
  arguments: string
  result?: string
  status: 'running' | 'done' | 'error'
}

export type TimelineItem =
  | { id: string; type: 'reasoning'; content: string }
  | { id: string; type: 'tool'; toolCall: ToolCallInfo }
  | { id: string; type: 'text'; content: string }

export interface ApiChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  mode?: ChatMode
  reasoning?: string
  toolCalls?: ToolCallInfo[]
  timeline?: TimelineItem[]
  toolName?: string
  isStreaming?: boolean
  isError?: boolean
  interrupted?: boolean
  images?: string[]
  apiMessages?: ApiChatMessage[]
  runAnalytics?: AgentRunAnalytics
}

export type ToolValidationIssue =
  | 'invalid_arguments_json'
  | 'missing_required_argument'
  | 'unknown_tool'
  | 'tool_not_allowed_in_mode'
  | 'empty_path'
  | 'empty_query'
  | 'empty_command'
  | 'execution_error'
  | 'search_replace_not_found'
  | 'search_replace_ambiguous'
  | 'search_replace_identical'
  | 'terminal_blocked'
  | 'no_results'

export type ToolCallOutcome = 'success' | 'error' | 'invalid_args'

export interface ToolCallAnalytics {
  id: string
  toolCallId: string
  iteration: number
  name: string
  argumentsRaw: string
  argumentsParsed: Record<string, unknown> | null
  startedAt: string
  durationMs: number
  outcome: ToolCallOutcome
  issues: ToolValidationIssue[]
  resultPreview: string
  resultLength: number
}

export interface AgentRunAnalytics {
  runId: string
  mode: ChatMode
  model: string
  userMessagePreview: string
  startedAt: string
  endedAt: string
  status: 'completed' | 'error' | 'aborted' | 'max_iterations'
  iterations: number
  maxIterations: number
  error?: string
  toolCalls: ToolCallAnalytics[]
  summary: {
    totalTools: number
    success: number
    errors: number
    invalidArgs: number
    issueCounts: Record<string, number>
    byTool: Record<string, { total: number; success: number; error: number }>
  }
}

export interface ToolApprovalRequest {
  id: string
  toolCallId: string
  name: string
  arguments: string
  preview?: string
  diff?: string
}

export interface AgentEvent {
  type:
    | 'stream'
    | 'reasoning_stream'
    | 'tool_start'
    | 'tool_progress'
    | 'tool_done'
    | 'done'
    | 'error'
    | 'run_analytics'
    | 'approval_request'
  content?: string
  toolCall?: ToolCallInfo
  message?: ChatMessage
  error?: string
  analytics?: AgentRunAnalytics
  approval?: ToolApprovalRequest
}

export interface ModelInfo {
  id: string
  name: string
  description?: string
  contextLength?: number
  contextLabel?: string
  inputModalities: string[]
  outputModalities: string[]
  supportsTools: boolean
  supportsVision: boolean
  agenticIndex?: number | null
  /** USD per 1M input tokens */
  promptPricePerM: number | null
  /** USD per 1M output tokens */
  completionPricePerM: number | null
  /** Ready-to-display pricing label */
  priceLabel: string
}

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}
