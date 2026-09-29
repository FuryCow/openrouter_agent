import type { McpServerConfig } from '@/types'

export {
  parseCursorMcpJson,
  toCursorMcpJson,
  validateMcpServerConfigs
} from '../../electron/services/mcp/mcp-config-core'

import { toCursorMcpJson } from '../../electron/services/mcp/mcp-config-core'

export function mcpServerConfigsEqual(
  a: McpServerConfig[],
  b: McpServerConfig[] | undefined
): boolean {
  return JSON.stringify(toCursorMcpJson(a)) === JSON.stringify(toCursorMcpJson(b ?? []))
}
