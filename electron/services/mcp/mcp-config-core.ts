import type { McpServerConfig, McpTransportType } from '../../types'
import { AppError, AppErrorCode } from '../../lib/app-errors'

export interface CursorMcpJson {
  mcpServers?: Record<string, CursorMcpServerEntry>
}

export interface CursorMcpServerEntry {
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  disabled?: boolean
}

export function detectTransport(entry: CursorMcpServerEntry): McpTransportType {
  if (entry.command) return 'stdio'
  if (entry.url) return 'streamable-http'
  throw new AppError(AppErrorCode.MCP_TRANSPORT_REQUIRED)
}

export function normalizeServerConfig(config: McpServerConfig): McpServerConfig {
  return {
    ...config,
    id: config.id.trim(),
    name: config.name?.trim() || config.id,
    args: config.args ?? [],
    env: config.env ?? {},
    headers: config.headers ?? {}
  }
}

export function parseCursorMcpJson(raw: unknown): McpServerConfig[] {
  if (!raw || typeof raw !== 'object') {
    throw new AppError(AppErrorCode.MCP_INVALID_JSON_OBJECT)
  }

  const data = raw as CursorMcpJson
  const servers = data.mcpServers
  if (!servers || typeof servers !== 'object') {
    throw new AppError(AppErrorCode.MCP_MISSING_MCP_SERVERS)
  }

  const result: McpServerConfig[] = []

  for (const [id, entry] of Object.entries(servers)) {
    if (!entry || typeof entry !== 'object') {
      throw new AppError(AppErrorCode.MCP_INVALID_SERVER_ENTRY, { id })
    }

    const transport = detectTransport(entry)
    result.push(
      normalizeServerConfig({
        id,
        name: id,
        enabled: entry.disabled !== true,
        transport,
        command: entry.command,
        args: entry.args,
        env: entry.env,
        cwd: entry.cwd,
        url: entry.url,
        headers: entry.headers
      })
    )
  }

  return result
}

export function toCursorMcpJson(servers: McpServerConfig[]): CursorMcpJson {
  const mcpServers: Record<string, CursorMcpServerEntry> = {}

  for (const server of servers) {
    const entry: CursorMcpServerEntry = {}

    if (server.transport === 'stdio') {
      if (server.command) entry.command = server.command
      if (server.args && server.args.length > 0) entry.args = server.args
      if (server.env && Object.keys(server.env).length > 0) entry.env = server.env
      if (server.cwd) entry.cwd = server.cwd
    } else {
      if (server.url) entry.url = server.url
      if (server.headers && Object.keys(server.headers).length > 0) entry.headers = server.headers
    }

    if (!server.enabled) entry.disabled = true
    mcpServers[server.id] = entry
  }

  return { mcpServers }
}

export function mergeMcpServerConfigs(
  base: McpServerConfig[],
  overrides: McpServerConfig[]
): McpServerConfig[] {
  const map = new Map<string, McpServerConfig>()
  for (const server of base) {
    map.set(server.id, normalizeServerConfig(server))
  }
  for (const server of overrides) {
    map.set(server.id, normalizeServerConfig(server))
  }
  return [...map.values()]
}

export function validateMcpServerConfig(config: McpServerConfig): AppError | null {
  if (!config.id.trim()) return new AppError(AppErrorCode.MCP_SERVER_ID_REQUIRED)

  if (config.transport === 'stdio') {
    if (!config.command?.trim()) {
      return new AppError(AppErrorCode.MCP_COMMAND_REQUIRED, { id: config.id })
    }
    return null
  }

  if (!config.url?.trim()) {
    return new AppError(AppErrorCode.MCP_URL_REQUIRED, { id: config.id })
  }
  try {
    new URL(config.url)
  } catch {
    return new AppError(AppErrorCode.MCP_INVALID_URL, { id: config.id })
  }
  return null
}

export function validateMcpServerConfigs(servers: McpServerConfig[]): AppError | null {
  const ids = new Set<string>()
  for (const server of servers) {
    const error = validateMcpServerConfig(server)
    if (error) return error
    if (ids.has(server.id)) {
      return new AppError(AppErrorCode.MCP_DUPLICATE_ID, { id: server.id })
    }
    ids.add(server.id)
  }
  return null
}
