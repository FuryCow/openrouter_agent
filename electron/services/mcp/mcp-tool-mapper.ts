import type { Tool } from '@modelcontextprotocol/client'
import type { ToolDefinition } from '../openrouter'

export const MCP_TOOL_PREFIX = 'mcp__'

export interface ParsedMcpToolName {
  serverId: string
  toolName: string
}

export function qualifyMcpToolName(serverId: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}${serverId}__${toolName}`
}

export function isMcpQualifiedToolName(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX)
}

export function parseMcpQualifiedToolName(name: string): ParsedMcpToolName | null {
  if (!isMcpQualifiedToolName(name)) return null
  const rest = name.slice(MCP_TOOL_PREFIX.length)
  const sep = rest.indexOf('__')
  if (sep <= 0) return null
  const serverId = rest.slice(0, sep)
  const toolName = rest.slice(sep + 2)
  if (!serverId || !toolName) return null
  return { serverId, toolName }
}

export function mapMcpToolToOpenRouter(serverId: string, tool: Tool): ToolDefinition {
  const description = tool.description?.trim() || `MCP tool from server "${serverId}"`
  const parameters =
    tool.inputSchema && typeof tool.inputSchema === 'object'
      ? (tool.inputSchema as Record<string, unknown>)
      : { type: 'object', properties: {} }

  return {
    type: 'function',
    function: {
      name: qualifyMcpToolName(serverId, tool.name),
      description: `[MCP:${serverId}] ${description}`,
      parameters
    }
  }
}
