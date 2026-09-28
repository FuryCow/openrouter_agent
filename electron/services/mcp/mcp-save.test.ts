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
})
