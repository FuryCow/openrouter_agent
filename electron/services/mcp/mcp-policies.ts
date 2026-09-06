import type { McpServerConfig } from '../../types'

const READONLY_PREFIXES = /^(get_|list_|search_|read_|fetch_|query_)/i

export function isMcpToolReadOnly(originalToolName: string): boolean {
  return READONLY_PREFIXES.test(originalToolName)
}

export function mcpToolRequiresApproval(
  server: McpServerConfig | undefined,
  originalToolName: string,
  globalRequireApproval: boolean
): boolean {
  if (server?.autoApprove) return false
  if (!globalRequireApproval) return false
  return !isMcpToolReadOnly(originalToolName)
}
