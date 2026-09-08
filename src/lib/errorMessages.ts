import type { TFunction } from 'i18next'

const ERROR_CODE_TO_KEY: Record<string, string> = {
  'agent.alreadyRunning': 'agent.alreadyRunning',
  'agent.noWorkspaceFolder': 'agent.noWorkspaceFolder',
  'settings.saveWhileRunning': 'settings.saveWhileRunning',
  'workspace.pathRequired': 'workspace.pathRequired',
  'workspace.agentAppFolder': 'workspace.agentAppFolder',
  'workspace.notAllowed': 'workspace.notAllowed',
  'memory.noWorkspace': 'memory.noWorkspace',
  'memory.disabled': 'memory.disabled',
  'memory.contentRequired': 'memory.contentRequired',
  'mcp.cursorConfigNotFound': 'mcp.cursorConfigNotFound',
  'mcp.invalidJsonObject': 'mcp.invalidJsonObject',
  'mcp.missingMcpServers': 'mcp.missingMcpServers',
  'mcp.invalidServerEntry': 'mcp.invalidServerEntry',
  'mcp.transportRequired': 'mcp.transportRequired',
  'mcp.serverIdRequired': 'mcp.serverIdRequired',
  'mcp.commandRequired': 'mcp.commandRequired',
  'mcp.urlRequired': 'mcp.urlRequired',
  'mcp.invalidUrl': 'mcp.invalidUrl',
  'mcp.duplicateId': 'mcp.duplicateId',
  'openrouter.requestFailed': 'openrouter.requestFailed',
  'openrouter.apiKeyMissing': 'openrouter.apiKeyMissing',
  'openrouter.connectionFailed': 'openrouter.connectionFailed',
  'openrouter.noResponseBody': 'openrouter.noResponseBody',
  'terminal.emptyCommand': 'terminal.emptyCommand',
  'terminal.shellSearchBlocked': 'terminal.shellSearchBlocked',
  'terminal.destructiveBlocked': 'terminal.destructiveBlocked',
  'index.scanning': 'index.scanning',
  'index.indexingFiles': 'index.indexingFiles',
  'index.embedding': 'index.embedding'
}

export function resolveErrorMessage(
  code: string | undefined,
  params: Record<string, string> | undefined,
  fallback: string | undefined,
  t: TFunction<'errors'>
): string {
  if (code) {
    const key = ERROR_CODE_TO_KEY[code]
    if (key && t(key, params ?? {}) !== key) {
      return t(key, params ?? {})
    }
  }
  return fallback || t('agent.requestFailed')
}
