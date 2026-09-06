import { describe, expect, it } from 'vitest'
import type { ToolCall } from '../services/openrouter'
import { buildExecutionWaves } from './tool-execution-plan'

function call(name: string, id: string): ToolCall {
  return {
    id,
    type: 'function',
    function: { name, arguments: '{}' }
  }
}

describe('buildExecutionWaves MCP grouping', () => {
  it('serializes MCP tools from the same server', () => {
    const waves = buildExecutionWaves(
      [
        call('mcp__github__search_repositories', '1'),
        call('mcp__github__get_issue', '2'),
        call('mcp__slack__post_message', '3')
      ],
      '/proj'
    )

    expect(waves).toHaveLength(2)
    expect(waves[0]).toHaveLength(1)
    expect(waves[0][0].function.name).toBe('mcp__github__search_repositories')
    expect(waves[1]).toHaveLength(2)
  })

  it('allows parallel MCP tools from different servers', () => {
    const waves = buildExecutionWaves(
      [
        call('mcp__github__search_repositories', '1'),
        call('mcp__slack__post_message', '2')
      ],
      '/proj'
    )

    expect(waves).toHaveLength(1)
    expect(waves[0]).toHaveLength(2)
  })
})
