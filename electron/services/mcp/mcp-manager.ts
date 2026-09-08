import type { ChatMode, McpServerConfig, McpServerStatus, McpStatusSnapshot } from '../../types'
import type { ToolDefinition } from '../openrouter'
import { McpClientSession } from './mcp-client-session'
import {
  isMcpQualifiedToolName,
  mapMcpToolToOpenRouter,
  parseMcpQualifiedToolName
} from './mcp-tool-mapper'
import { validateMcpServerConfigs } from './mcp-config'
import { isMcpToolReadOnly, mcpToolRequiresApproval } from './mcp-policies'

interface ServerRuntime {
  config: McpServerConfig
  session: McpClientSession
  status: McpServerStatus['status']
  tools: ToolDefinition[]
  lastError?: string
}

export type McpStatusListener = (status: McpStatusSnapshot) => void

export class McpManager {
  private servers = new Map<string, ServerRuntime>()
  private globalRequireApproval = true
  private reconnectPending = false
  private listeners = new Set<McpStatusListener>()

  constructor(
    private getSettings: () => { mcpServers?: McpServerConfig[]; mcpRequireApproval?: boolean },
    private onStatusChanged?: McpStatusListener
  ) {}

  subscribe(listener: McpStatusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async initialize(): Promise<void> {
    await this.reconnectAll()
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.servers.values()].map((s) => s.session.disconnect()))
    this.servers.clear()
    this.emitStatus()
  }

  queueReconnectAfterRun(): void {
    this.reconnectPending = true
  }

  async flushPendingReconnect(): Promise<void> {
    if (!this.reconnectPending) return
    this.reconnectPending = false
    await this.reconnectAll()
  }

  isAgentBlockingReconnect(): boolean {
    return this.reconnectPending
  }

  getStatus(): McpStatusSnapshot {
    for (const runtime of this.servers.values()) {
      this.normalizeRuntimeStatus(runtime)
    }

    const servers = [...this.servers.values()].map((runtime) => ({
      id: runtime.config.id,
      name: runtime.config.name ?? runtime.config.id,
      enabled: runtime.config.enabled,
      transport: runtime.session.connectedTransport ?? runtime.config.transport,
      status: runtime.config.enabled ? runtime.status : ('disabled' as const),
      toolCount: runtime.tools.length,
      lastError:
        runtime.config.enabled && runtime.status === 'error'
          ? runtime.lastError
          : undefined
    }))

    const enabledCount = servers.filter((s) => s.enabled).length
    const connectedCount = servers.filter((s) => s.status === 'connected').length
    const totalTools = servers.reduce((sum, s) => sum + s.toolCount, 0)

    return { servers, totalTools, connectedCount, enabledCount }
  }

  getConfig(): McpServerConfig[] {
    return this.getSettings().mcpServers ?? []
  }

  async saveConfig(servers: McpServerConfig[]): Promise<McpServerConfig[]> {
    const error = validateMcpServerConfigs(servers)
    if (error) throw error
    return servers
  }

  async reconnectAll(): Promise<void> {
    const settings = this.getSettings()
    this.globalRequireApproval = settings.mcpRequireApproval !== false

    await Promise.all([...this.servers.values()].map((s) => s.session.disconnect()))
    this.servers.clear()

    const configs = settings.mcpServers ?? []
    for (const config of configs) {
      const runtime: ServerRuntime = {
        config,
        session: new McpClientSession(),
        status: config.enabled ? 'connecting' : 'disabled',
        tools: []
      }
      this.servers.set(config.id, runtime)
    }

    this.emitStatus()

    await Promise.all(
      configs.filter((c) => c.enabled).map((config) => this.connectServer(config.id))
    )
    this.emitStatus()
  }

  async testServer(config: McpServerConfig): Promise<{ ok: boolean; toolCount: number; error?: string }> {
    const error = validateMcpServerConfigs([config])
    if (error) return { ok: false, toolCount: 0, error: error.code }

    const session = new McpClientSession()
    try {
      const { tools } = await session.connect(config, { timeoutMs: 120_000 })
      return { ok: true, toolCount: tools.length }
    } catch (err) {
      return {
        ok: false,
        toolCount: 0,
        error: err instanceof Error ? err.message : String(err)
      }
    } finally {
      await session.disconnect()
    }
  }

  private async connectServer(serverId: string): Promise<void> {
    const runtime = this.servers.get(serverId)
    if (!runtime || !runtime.config.enabled) return

    runtime.status = 'connecting'
    runtime.lastError = undefined
    this.emitStatus()

    try {
      const { tools } = await runtime.session.connect(runtime.config)
      runtime.tools = tools.map((tool) => mapMcpToolToOpenRouter(serverId, tool))
      runtime.status = 'connected'
      runtime.lastError = undefined
    } catch (err) {
      runtime.status = 'error'
      runtime.tools = []
      runtime.lastError = err instanceof Error ? err.message : String(err)
    }
  }

  /** Heal stale error state left by older builds after a successful tool listing. */
  private normalizeRuntimeStatus(runtime: ServerRuntime): void {
    if (
      runtime.status === 'error' &&
      runtime.tools.length > 0 &&
      runtime.session.connectedTransport
    ) {
      runtime.status = 'connected'
      runtime.lastError = undefined
    }
  }

  isMcpTool(name: string): boolean {
    return isMcpQualifiedToolName(name)
  }

  getToolsForMode(mode: ChatMode): ToolDefinition[] {
    if (mode === 'ask') return []

    const tools: ToolDefinition[] = []
    for (const runtime of this.servers.values()) {
      if (runtime.status !== 'connected') continue
      if (mode === 'planner') {
        tools.push(
          ...runtime.tools.filter((tool) => {
            const parsed = parseMcpQualifiedToolName(tool.function.name)
            return parsed ? isMcpToolReadOnly(parsed.toolName) : false
          })
        )
      } else {
        tools.push(...runtime.tools)
      }
    }
    return tools
  }

  isToolAllowedInMode(toolName: string, mode: ChatMode): boolean {
    if (!isMcpQualifiedToolName(toolName)) return true
    if (mode === 'ask') return false
    if (mode === 'agent') return true

    const parsed = parseMcpQualifiedToolName(toolName)
    if (!parsed) return false
    return isMcpToolReadOnly(parsed.toolName)
  }

  requiresApproval(toolName: string): boolean {
    const parsed = parseMcpQualifiedToolName(toolName)
    if (!parsed) return true
    const runtime = this.servers.get(parsed.serverId)
    return mcpToolRequiresApproval(
      runtime?.config,
      parsed.toolName,
      this.globalRequireApproval
    )
  }

  getServerName(serverId: string): string {
    return this.servers.get(serverId)?.config.name ?? serverId
  }

  getConnectedServerSummaries(): Array<{ id: string; name: string; toolCount: number }> {
    return [...this.servers.values()]
      .filter((s) => s.status === 'connected')
      .map((s) => ({
        id: s.config.id,
        name: s.config.name ?? s.config.id,
        toolCount: s.tools.length
      }))
  }

  getServerIdForTool(toolName: string): string | null {
    return parseMcpQualifiedToolName(toolName)?.serverId ?? null
  }

  async callTool(qualifiedName: string, args: Record<string, unknown>): Promise<string> {
    const parsed = parseMcpQualifiedToolName(qualifiedName)
    if (!parsed) {
      return `Error: Invalid MCP tool name: ${qualifiedName}`
    }

    this.syncRuntimeConfigsFromSettings()

    let runtime = this.servers.get(parsed.serverId)
    if (!runtime) {
      return `Error: MCP server "${parsed.serverId}" is not configured. Add it in Settings → MCP and click Test & save.`
    }

    if (runtime.status !== 'connected' && runtime.config.enabled) {
      await this.connectServer(parsed.serverId)
      runtime = this.servers.get(parsed.serverId)
    }

    if (!runtime || runtime.status !== 'connected') {
      const status = runtime?.status ?? 'missing'
      const detail = runtime?.lastError ? ` ${runtime.lastError}` : ''
      return (
        `Error: MCP server "${parsed.serverId}" is not connected (status: ${status}).${detail} ` +
        `Open Settings → MCP → Reconnect all, or abort the agent run and save MCP settings again.`
      )
    }

    try {
      return await runtime.session.callTool(parsed.toolName, args)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error: ${message}`
    }
  }

  /** Keep in-memory server entries aligned with persisted settings (e.g. after save while agent runs). */
  private syncRuntimeConfigsFromSettings(): void {
    const configs = this.getSettings().mcpServers ?? []
    const seen = new Set<string>()

    for (const config of configs) {
      seen.add(config.id)
      const existing = this.servers.get(config.id)
      if (existing) {
        existing.config = config
        continue
      }
      this.servers.set(config.id, {
        config,
        session: new McpClientSession(),
        status: config.enabled ? 'error' : 'disabled',
        tools: [],
        lastError: config.enabled ? 'Not connected yet — use Reconnect all in Settings' : undefined
      })
    }

    for (const id of [...this.servers.keys()]) {
      if (!seen.has(id)) this.servers.delete(id)
    }
  }

  private emitStatus(): void {
    const status = this.getStatus()
    this.onStatusChanged?.(status)
    for (const listener of this.listeners) {
      listener(status)
    }
  }
}
