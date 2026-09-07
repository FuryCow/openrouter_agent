import { describe, expect, it, vi, afterEach } from 'vitest'
import { inferStdioCwd, normalizeStdioConfig, resolveStdioCommand } from './mcp-stdio'

describe('mcp-stdio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('appends .cmd for npx/npm on Windows', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    expect(resolveStdioCommand('npx')).toBe('npx.cmd')
    expect(resolveStdioCommand('npm')).toBe('npm.cmd')
    expect(resolveStdioCommand('node')).toBe('node')
    expect(resolveStdioCommand('C:\\tools\\node.exe')).toBe('C:\\tools\\node.exe')
  })

  it('leaves command unchanged on non-Windows', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    expect(resolveStdioCommand('npx')).toBe('npx')
  })

  it('infers cwd from absolute script arg', () => {
    expect(
      inferStdioCwd({
        args: ['F:/pets/gmail_mcp/dist/index.js']
      })
    ).toBe('F:/pets/gmail_mcp')
    expect(
      inferStdioCwd({
        args: ['/home/user/project/dist/index.js']
      })
    ).toBe('/home/user/project')
    expect(
      normalizeStdioConfig({
        command: 'node',
        args: ['F:/pets/gmail_mcp/dist/index.js']
      })
    ).toEqual({
      command: 'node',
      args: ['F:/pets/gmail_mcp/dist/index.js'],
      cwd: 'F:/pets/gmail_mcp'
    })
  })
})
