import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { McpServerConfig } from '../../types'
import {
  mergeMcpServerConfigs,
  parseCursorMcpJson,
  toCursorMcpJson,
  validateMcpServerConfigs
} from './mcp-config-core'

export interface WorkspaceMcpResolution {
  servers: McpServerConfig[]
  overrideIds: string[]
  error?: string
}

export function getWorkspaceOpenRouterMcpPath(workspacePath: string): string {
  return join(workspacePath, '.openrouter', 'mcp.json')
}

export function readWorkspaceMcpOverride(workspaceDir: string): { servers: McpServerConfig[]; error?: string } {
  const path = getWorkspaceOpenRouterMcpPath(workspaceDir)
  if (!existsSync(path)) return { servers: [] }

  let raw = ''
  try {
    raw = readFileSync(path, 'utf-8')
  } catch (err) {
    return { servers: [], error: err instanceof Error ? err.message : String(err) }
  }

  const trimmed = raw.trim()
  if (!trimmed) return { servers: [] }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { servers: [], error: 'mcp.invalidJsonObject' }
    }
    if (!('mcpServers' in parsed)) return { servers: [] }
    return { servers: parseCursorMcpJson(parsed) }
  } catch (err) {
    return { servers: [], error: err instanceof Error ? err.message : String(err) }
  }
}

export function resolveWorkspaceMcpServers(
  globalServers: McpServerConfig[],
  workspaceDir?: string | null
): WorkspaceMcpResolution {
  if (!workspaceDir?.trim()) {
    return { servers: mergeMcpServerConfigs(globalServers, []), overrideIds: [] }
  }

  const override = readWorkspaceMcpOverride(workspaceDir)
  if (override.error) {
    return { servers: mergeMcpServerConfigs(globalServers, []), overrideIds: [], error: override.error }
  }

  return {
    servers: mergeMcpServerConfigs(globalServers, override.servers),
    overrideIds: override.servers.map((server) => server.id)
  }
}

export function writeWorkspaceMcpOverride(workspaceDir: string, servers: McpServerConfig[]): void {
  const error = validateMcpServerConfigs(servers)
  if (error) throw error

  const path = getWorkspaceOpenRouterMcpPath(workspaceDir)
  if (servers.length === 0) {
    if (existsSync(path)) rmSync(path)
    return
  }

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(toCursorMcpJson(servers), null, 2), 'utf-8')
}

export function scheduleWorkspaceMcpReconnect(
  agentRunning: boolean,
  manager: { queueReconnectAfterRun: () => void; reconnectAll: () => Promise<void> }
): Promise<void> | void {
  if (agentRunning) {
    manager.queueReconnectAfterRun()
    return
  }
  return manager.reconnectAll()
}
