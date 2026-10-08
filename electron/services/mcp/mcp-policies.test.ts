import { describe, expect, it } from 'vitest'
import { isMcpToolReadOnly, mcpToolRequiresApproval } from './mcp-policies'
import type { McpServerConfig } from '../../types'

const server = (overrides: Partial<McpServerConfig> = {}): McpServerConfig => ({
  id: 'srv',
  enabled: true,
  transport: 'stdio',
  ...overrides
})

describe('isMcpToolReadOnly', () => {
  it('recognizes read-only prefixes case-insensitively', () => {
    expect(isMcpToolReadOnly('get_user')).toBe(true)
    expect(isMcpToolReadOnly('list_files')).toBe(true)
    expect(isMcpToolReadOnly('search_docs')).toBe(true)
    expect(isMcpToolReadOnly('read_config')).toBe(true)
    expect(isMcpToolReadOnly('fetch_url')).toBe(true)
    expect(isMcpToolReadOnly('query_db')).toBe(true)
    expect(isMcpToolReadOnly('GET_USER')).toBe(true)
  })

  it('treats write-like tools as not read-only', () => {
    expect(isMcpToolReadOnly('create_issue')).toBe(false)
    expect(isMcpToolReadOnly('delete_file')).toBe(false)
    expect(isMcpToolReadOnly('update_record')).toBe(false)
    expect(isMcpToolReadOnly('write')).toBe(false)
    expect(isMcpToolReadOnly('')).toBe(false)
  })

  it('requires the prefix at the start of the name', () => {
    expect(isMcpToolReadOnly('my_get_user')).toBe(false)
  })
})

describe('mcpToolRequiresApproval', () => {
  it('never requires approval when the server auto-approves', () => {
    expect(mcpToolRequiresApproval(server({ autoApprove: true }), 'delete_file', true)).toBe(false)
  })

  it('never requires approval when the global flag is off', () => {
    expect(mcpToolRequiresApproval(server(), 'delete_file', false)).toBe(false)
  })

  it('requires approval for write-like tools when enabled globally', () => {
    expect(mcpToolRequiresApproval(server(), 'create_issue', true)).toBe(true)
  })

  it('skips approval for read-only tools even when enabled globally', () => {
    expect(mcpToolRequiresApproval(server(), 'list_files', true)).toBe(false)
  })

  it('handles an undefined server config', () => {
    expect(mcpToolRequiresApproval(undefined, 'create_issue', true)).toBe(true)
    expect(mcpToolRequiresApproval(undefined, 'get_user', true)).toBe(false)
  })
})
