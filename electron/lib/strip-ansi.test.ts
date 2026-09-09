import { describe, expect, it } from 'vitest'
import { sanitizeTerminalOutput, stripAnsi } from './strip-ansi'

describe('stripAnsi', () => {
  it('removes CSI and OSC sequences from PowerShell PTY noise', () => {
    const raw =
      '\x1B[?9001h\x1B[?1004h\x1B[?25l\x1B[2J\x1Bm\x1B[H\x1B]0;powershell\x07npm test passed'
    expect(stripAnsi(raw)).toBe('npm test passed')
  })

  it('preserves normal command output', () => {
    expect(stripAnsi('Tests: 3 passed\n')).toBe('Tests: 3 passed\n')
  })
})

describe('sanitizeTerminalOutput', () => {
  it('returns placeholder when output is only escape codes', () => {
    expect(sanitizeTerminalOutput('\x1B[?25l\x1B[2J\x1Bm')).toBe('(no output)')
  })
})
