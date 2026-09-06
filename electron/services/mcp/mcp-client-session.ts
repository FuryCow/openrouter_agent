import {
  Client,
  SSEClientTransport,
  StreamableHTTPClientTransport,
  type Tool,
  type Transport
} from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import type { McpServerConfig, McpTransportType } from '../../types'
import { formatCallToolResult } from './mcp-result-formatter'
import { normalizeStdioConfig } from './mcp-stdio'

const CALL_TIMEOUT_MS = 60_000
const CONNECT_TIMEOUT_MS = 120_000

export interface McpSessionConnectResult {
  tools: Tool[]
  transport: McpTransportType
}

export class McpClientSession {
  private client: Client | null = null
  private transport: Transport | null = null
  private activeTransport: McpTransportType | null = null

  get connectedTransport(): McpTransportType | null {
    return this.activeTransport
  }

  async connect(
    config: McpServerConfig,
    options?: { timeoutMs?: number }
  ): Promise<McpSessionConnectResult> {
    const timeoutMs = options?.timeoutMs ?? CONNECT_TIMEOUT_MS
    let timedOut = false

    const run = async (): Promise<McpSessionConnectResult> => {
      await this.disconnect()

      if (config.transport === 'stdio') {
        return this.connectStdio(config)
      }

      if (config.transport === 'sse') {
        return this.connectRemote(config, 'sse')
      }

      try {
        return await this.connectRemote(config, 'streamable-http')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[MCP] Streamable HTTP failed for "${config.id}", trying SSE: ${message}`)
        return this.connectRemote(config, 'sse')
      }
    }

    const timer = setTimeout(() => {
      timedOut = true
      void this.disconnect()
    }, timeoutMs)

    try {
      return await run()
    } catch (err) {
      if (timedOut) {
        throw new Error(
          `Connection timed out after ${Math.round(timeoutMs / 1000)}s. First run may need npx to download the package — try again.`
        )
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private async connectStdio(config: McpServerConfig): Promise<McpSessionConnectResult> {
    const normalized = normalizeStdioConfig(config)
    if (!normalized.command?.trim()) {
      throw new Error('stdio transport requires command')
    }

    const transport = new StdioClientTransport({
      command: normalized.command,
      args: normalized.args,
      env: normalized.env,
      cwd: normalized.cwd,
      stderr: 'pipe'
    })

    const client = new Client({ name: 'openrouter-agent', version: '0.4.0' })
    await client.connect(transport)

    const { tools } = await client.listTools()
    this.client = client
    this.transport = transport
    this.activeTransport = 'stdio'
    return { tools, transport: 'stdio' }
  }

  private async connectRemote(
    config: McpServerConfig,
    kind: 'streamable-http' | 'sse'
  ): Promise<McpSessionConnectResult> {
    if (!config.url?.trim()) {
      throw new Error('remote transport requires url')
    }

    const url = new URL(config.url)
    const requestInit: RequestInit = {}
    if (config.headers && Object.keys(config.headers).length > 0) {
      requestInit.headers = { ...config.headers }
    }

    const transport =
      kind === 'streamable-http'
        ? new StreamableHTTPClientTransport(url, { requestInit })
        : new SSEClientTransport(url, { requestInit })

    const client = new Client({ name: 'openrouter-agent', version: '0.4.0' })
    await client.connect(transport)

    const { tools } = await client.listTools()
    this.client = client
    this.transport = transport
    this.activeTransport = kind
    return { tools, transport: kind }
  }

  async listTools(): Promise<Tool[]> {
    if (!this.client) return []
    const { tools } = await this.client.listTools()
    return tools
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) {
      throw new Error('MCP server is not connected')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)

    try {
      const result = await this.client.callTool(
        { name: toolName, arguments: args },
        { signal: controller.signal }
      )
      return formatCallToolResult(result)
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`MCP tool call timed out after ${CALL_TIMEOUT_MS / 1000}s`)
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async disconnect(): Promise<void> {
    const client = this.client
    const transport = this.transport
    this.client = null
    this.transport = null
    this.activeTransport = null

    if (client) {
      try {
        await client.close()
      } catch {
        // ignore close errors
      }
    }

    if (transport) {
      try {
        await transport.close()
      } catch {
        // ignore close errors
      }
    }
  }
}
