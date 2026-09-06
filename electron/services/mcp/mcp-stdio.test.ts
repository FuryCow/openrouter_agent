import { describe, expect, it } from 'vitest'
import { resolveStdioCommand } from './mcp-stdio'

describe('mcp-stdio', () => {
  it('appends .cmd for npx on Windows', () => {
    const original = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })
    expect(resolveStdioCommand('npx')).toBe('npx.cmd')
    expect(resolveStdioCommand('C:\\tools\\node.exe')).toBe('C:\\tools\\node.exe')
    Object.defineProperty(process, 'platform', { value: original })
  })
})
