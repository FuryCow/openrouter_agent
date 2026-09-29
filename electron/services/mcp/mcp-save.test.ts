import { describe, expect, it } from 'vitest'
import { McpManager } from './mcp-manager'
import type { McpServerConfig } from '../../types'

const docs: McpServerConfig = {
  id: 'docs',
  name: 'Docs',
  enabled: true,
  transport: 'stdio',
  command: 'node'
}

describe('MCP save and test', () => {
  it('saving a server does not connect it', async () => {
    let stored: McpServerConfig[] = []
    const manager = new McpManager(() => ({ mcpServers: stored, mcpRequireApproval: true }))

    stored = await manager.saveConfig([docs])

    expect(stored).toEqual([docs])
    expect(manager.getStatus().connectedCount).toBe(0)
    expect(manager.getStatus().servers).toEqual([])
  })

  it('testing a server that has no command fails that server and leaves the saved list alone', async () => {
    const stored: McpServerConfig[] = [docs]
    const manager = new McpManager(() => ({ mcpServers: stored, mcpRequireApproval: true }))

    const result = await manager.testServer({
      id: 'broken',
      enabled: true,
      transport: 'stdio'
    })

    expect(result.ok).toBe(false)
    expect(manager.getConfig()).toEqual([docs])
    expect(manager.getStatus().connectedCount).toBe(0)
  })

  it('drops connected MCP tools when a server is saved as disabled', async () => {
    const stored: McpServerConfig[] = [{ ...docs, enabled: true }]
    const manager = new McpManager(() => ({ mcpServers: stored, mcpRequireApproval: true }))
    const servers = (manager as unknown as { servers: Map<string, unknown> }).servers
    servers.set('docs', {
      config: { ...docs, enabled: true },
      session: { disconnect: async () => undefined },
      status: 'connected',
      tools: [
        {
          type: 'function',
          function: { name: 'mcp__docs__search', description: 'search', parameters: {} }
        }
      ]
    })

    stored[0] = { ...docs, enabled: false }
    await manager.applyConfigFromSettings()

    expect(manager.getToolsForMode('agent')).toEqual([])
    expect(manager.getStatus().servers[0]).toMatchObject({ id: 'docs', status: 'disabled', toolCount: 0 })
  })
})
