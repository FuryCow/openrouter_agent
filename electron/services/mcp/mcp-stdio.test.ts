import { describe, expect, it, vi, afterEach } from 'vitest'
import { resolveStdioCommand } from './mcp-stdio'

describe('mcp-stdio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('appends .cmd for npx on Windows', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    expect(resolveStdioCommand('npx')).toBe('npx.cmd')
    expect(resolveStdioCommand('C:\\tools\\node.exe')).toBe('C:\\tools\\node.exe')
  })

  it('leaves command unchanged on non-Windows', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    expect(resolveStdioCommand('npx')).toBe('npx')
  })
})
