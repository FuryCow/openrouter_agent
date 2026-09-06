import { describe, expect, it } from 'vitest'
import { isMcpToolReadOnly, mcpToolRequiresApproval } from './mcp-policies'
import type { McpServerConfig } from '../../types'

describe('mcp-manager policies', () => {
  const server: McpServerConfig = {
    id: 'test',
    enabled: true,
    transport: 'stdio',
    command: 'npx'
  }

  it('treats common prefixes as read-only', () => {
    expect(isMcpToolReadOnly('list_tools')).toBe(true)
    expect(isMcpToolReadOnly('get_file')).toBe(true)
    expect(isMcpToolReadOnly('create_issue')).toBe(false)
  })

  it('requires approval for mutating tools by default', () => {
    expect(mcpToolRequiresApproval(server, 'create_issue', true)).toBe(true)
    expect(mcpToolRequiresApproval(server, 'list_items', true)).toBe(false)
  })

  it('skips approval when server autoApprove is enabled', () => {
    expect(mcpToolRequiresApproval({ ...server, autoApprove: true }, 'create_issue', true)).toBe(false)
  })

  it('skips approval when global require flag is off', () => {
    expect(mcpToolRequiresApproval(server, 'create_issue', false)).toBe(false)
  })
})
