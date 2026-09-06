import { describe, expect, it } from 'vitest'
import {
  isMcpQualifiedToolName,
  mapMcpToolToOpenRouter,
  parseMcpQualifiedToolName,
  qualifyMcpToolName
} from './mcp-tool-mapper'

describe('mcp-tool-mapper', () => {
  it('qualifies and parses tool names', () => {
    const qualified = qualifyMcpToolName('github', 'search_repositories')
    expect(qualified).toBe('mcp__github__search_repositories')
    expect(isMcpQualifiedToolName(qualified)).toBe(true)
    expect(parseMcpQualifiedToolName(qualified)).toEqual({
      serverId: 'github',
      toolName: 'search_repositories'
    })
  })

  it('maps MCP tool schema to OpenRouter definition', () => {
    const mapped = mapMcpToolToOpenRouter('github', {
      name: 'search_repositories',
      description: 'Search GitHub repos',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query']
      }
    })

    expect(mapped.function.name).toBe('mcp__github__search_repositories')
    expect(mapped.function.description).toContain('[MCP:github]')
    expect(mapped.function.parameters).toMatchObject({
      type: 'object',
      properties: { query: { type: 'string' } }
    })
  })
})
