import { homedir } from 'os'
import { join } from 'path'
export {
  detectTransport,
  mergeMcpServerConfigs,
  normalizeServerConfig,
  parseCursorMcpJson,
  toCursorMcpJson,
  validateMcpServerConfig,
  validateMcpServerConfigs,
  type CursorMcpJson,
  type CursorMcpServerEntry
} from './mcp-config-core'

export function getDefaultCursorMcpPath(): string {
  return join(homedir(), '.cursor', 'mcp.json')
}

export function getWorkspaceCursorMcpPath(workspacePath: string): string {
  return join(workspacePath, '.cursor', 'mcp.json')
}
