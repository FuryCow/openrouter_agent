export type ChatMode = 'agent' | 'ask' | 'planner'

export type McpTransportType = 'stdio' | 'streamable-http' | 'sse'

export interface McpServerConfig {
  id: string
  name?: string
  enabled: boolean
  transport: McpTransportType
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  autoApprove?: boolean
}

export type McpConnectionStatus = 'connected' | 'connecting' | 'error' | 'disabled'

export interface McpServerStatus {
  id: string
  name: string
  enabled: boolean
  transport: McpTransportType
  status: McpConnectionStatus
  toolCount: number
  lastError?: string
}

export interface McpStatusSnapshot {
  servers: McpServerStatus[]
  totalTools: number
  connectedCount: number
  enabledCount: number
}

export interface AppSettings {
  apiKey: string
  model: string
  workingDirectory: string
  recentWorkspaces?: string[]
  temperature?: number
  maxTokens?: number
  customSystemPrompt?: string
  autoApproveWrites?: boolean
  autoApproveTerminal?: boolean
  searchApiKey?: string
  searchProvider?: 'duckduckgo' | 'tavily' | 'brave'
  indexOnOpen?: boolean
  embeddingModel?: string
  maxFileSizeKb?: number
  semanticSearchEnabled?: boolean
  mcpServers?: McpServerConfig[]
  mcpImportPaths?: string[]
  mcpRequireApproval?: boolean
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

export type IndexState = 'idle' | 'building' | 'ready' | 'error'

export type IndexPhase =
  | 'scanning'
  | 'indexing_text'
  | 'indexing_symbols'
  | 'embedding'
  | 'vectors'
  | 'done'

export interface IndexProgress {
  phase: IndexPhase
  filesDone: number
  filesTotal: number
  message?: string
}

export interface IndexStatus {
  state: IndexState
  workspacePath: string | null
  filesIndexed: number
  chunks: number
  symbols: number
  lastBuiltAt: string | null
  progress: IndexProgress | null
  error: string | null
  semanticReady: boolean
  symbolReady: boolean
}

export type CodebaseSearchMode = 'hybrid' | 'text' | 'semantic' | 'symbol'

export interface CodebaseSearchRequest {
  query: string
  mode: CodebaseSearchMode
  root?: string
  limit?: number
  pathGlob?: string
}

export interface CodebaseSearchHit {
  path: string
  startLine: number
  endLine: number
  score: number
  channel: 'text' | 'semantic' | 'symbol'
  snippet: string
  symbolName?: string
  symbolKind?: string
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

export interface DiffHighlightRange {
  startLine: number
  endLine: number
}

export interface DiffDisplayLine {
  type: 'add' | 'del' | 'ctx' | 'sep'
  content: string
  oldLine?: number
  newLine?: number
}

export interface FileDiffPreview {
  lines: DiffDisplayLine[]
  scrollToLine: number
  highlightRanges: DiffHighlightRange[]
}

export interface ToolCallInfo {
  id: string
  name: string
  arguments: string
  result?: string
  status: 'running' | 'done' | 'error'
  /** @deprecated Use fileDiff */
  diff?: string
  filePath?: string
  fileDiff?: FileDiffPreview
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
  | 'index_not_ready'

export type ToolCallOutcome = 'success' | 'error' | 'invalid_args'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

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
  tokenUsage?: TokenUsage
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
  /** @deprecated Use fileDiff */
  diff?: string
  filePath?: string
  fileDiff?: FileDiffPreview
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
