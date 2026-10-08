export const AppErrorCode = {
  AGENT_ALREADY_RUNNING: 'agent.alreadyRunning',
  AGENT_NO_WORKSPACE: 'agent.noWorkspaceFolder',
  SETTINGS_SAVE_WHILE_RUNNING: 'settings.saveWhileRunning',
  WORKSPACE_PATH_REQUIRED: 'workspace.pathRequired',
  WORKSPACE_AGENT_APP_FOLDER: 'workspace.agentAppFolder',
  WORKSPACE_NOT_ALLOWED: 'workspace.notAllowed',
  MEMORY_NO_WORKSPACE: 'memory.noWorkspace',
  MEMORY_DISABLED: 'memory.disabled',
  MEMORY_CONTENT_REQUIRED: 'memory.contentRequired',
  MCP_CURSOR_CONFIG_NOT_FOUND: 'mcp.cursorConfigNotFound',
  MCP_INVALID_JSON_OBJECT: 'mcp.invalidJsonObject',
  MCP_MISSING_MCP_SERVERS: 'mcp.missingMcpServers',
  MCP_INVALID_SERVER_ENTRY: 'mcp.invalidServerEntry',
  MCP_TRANSPORT_REQUIRED: 'mcp.transportRequired',
  MCP_SERVER_ID_REQUIRED: 'mcp.serverIdRequired',
  MCP_COMMAND_REQUIRED: 'mcp.commandRequired',
  MCP_URL_REQUIRED: 'mcp.urlRequired',
  MCP_INVALID_URL: 'mcp.invalidUrl',
  MCP_DUPLICATE_ID: 'mcp.duplicateId',
  OPENROUTER_REQUEST_FAILED: 'openrouter.requestFailed',
  OPENROUTER_API_KEY_MISSING: 'openrouter.apiKeyMissing',
  OPENROUTER_CONNECTION_FAILED: 'openrouter.connectionFailed',
  OPENROUTER_NO_RESPONSE_BODY: 'openrouter.noResponseBody',
  TERMINAL_EMPTY_COMMAND: 'terminal.emptyCommand',
  TERMINAL_SHELL_SEARCH_BLOCKED: 'terminal.shellSearchBlocked',
  TERMINAL_DESTRUCTIVE_BLOCKED: 'terminal.destructiveBlocked',
  INDEX_SCANNING: 'index.scanning',
  INDEX_INDEXING_FILES: 'index.indexingFiles',
  INDEX_EMBEDDING: 'index.embedding'
} as const

export type AppErrorCodeValue = (typeof AppErrorCode)[keyof typeof AppErrorCode]

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCodeValue,
    public readonly params?: Record<string, string>
  ) {
    super(code)
    this.name = 'AppError'
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function getAppErrorPayload(err: unknown): {
  errorCode?: AppErrorCodeValue
  errorParams?: Record<string, string>
  error?: string
} {
  if (isAppError(err)) {
    return { errorCode: err.code, errorParams: err.params }
  }
  if (err instanceof Error) {
    return { error: err.message }
  }
  return { error: String(err) }
}
