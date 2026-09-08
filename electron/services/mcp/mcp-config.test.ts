import { describe, expect, it } from 'vitest'
import { AppError, AppErrorCode } from '../../lib/app-errors'
import {
  detectTransport,
  mergeMcpServerConfigs,
  parseCursorMcpJson,
  toCursorMcpJson,
  validateMcpServerConfigs
} from './mcp-config-core'

describe('mcp-config', () => {
  it('detects stdio vs remote transport', () => {
    expect(detectTransport({ command: 'npx', args: ['-y', 'pkg'] })).toBe('stdio')
    expect(detectTransport({ url: 'https://example.com/mcp' })).toBe('streamable-http')
  })

  it('parses Cursor mcp.json format', () => {
    const servers = parseCursorMcpJson({
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'token' }
        },
        remote: {
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer x' }
        }
      }
    })

    expect(servers).toHaveLength(2)
    expect(servers[0].id).toBe('github')
    expect(servers[0].transport).toBe('stdio')
    expect(servers[1].transport).toBe('streamable-http')
  })

  it('exports back to Cursor format', () => {
    const json = toCursorMcpJson([
      {
        id: 'github',
        enabled: true,
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'pkg']
      }
    ])

    expect(json.mcpServers?.github?.command).toBe('npx')
  })

  it('merges configs with workspace overrides', () => {
    const merged = mergeMcpServerConfigs(
      [{ id: 'a', enabled: true, transport: 'stdio', command: 'one' }],
      [{ id: 'a', enabled: false, transport: 'stdio', command: 'two' }, { id: 'b', enabled: true, transport: 'stdio', command: 'b' }]
    )

    expect(merged.find((s) => s.id === 'a')?.command).toBe('two')
    expect(merged.find((s) => s.id === 'b')?.command).toBe('b')
  })

  it('validates server configs', () => {
    expect(
      validateMcpServerConfigs([
        { id: 'stdio', enabled: true, transport: 'stdio', command: 'npx' },
        { id: 'http', enabled: true, transport: 'streamable-http', url: 'https://x.test/mcp' }
      ])
    ).toBeNull()

    expect(
      validateMcpServerConfigs([{ id: 'bad', enabled: true, transport: 'stdio' }])
    ).toEqual(new AppError(AppErrorCode.MCP_COMMAND_REQUIRED, { id: 'bad' }))
  })
})
