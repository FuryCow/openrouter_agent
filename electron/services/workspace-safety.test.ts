import { describe, expect, it } from 'vitest'
import { isPathInside, assertSafeTerminalCommand, isCodeSearchShellCommand } from './workspace-safety'

describe('isPathInside', () => {
  it('detects nested paths on posix', () => {
    expect(isPathInside('/tmp/agent', '/tmp/agent/src')).toBe(true)
    expect(isPathInside('/tmp/agent', '/tmp/other')).toBe(false)
  })

  it('does not treat cross-drive Windows paths as nested', () => {
    if (process.platform !== 'win32') return
    expect(isPathInside('F:\\openrouter_agent', 'C:\\Users\\dream\\project')).toBe(false)
    expect(
      isPathInside(
        'C:\\Users\\dream\\OneDrive\\Desktop\\openrouter_agent',
        'C:\\Users\\dream\\OneDrive\\Desktop\\money_inventarization_age'
      )
    ).toBe(false)
  })

  it('blocks paths inside the agent root on Windows', () => {
    if (process.platform !== 'win32') return
    expect(isPathInside('F:\\openrouter_agent', 'F:\\openrouter_agent\\src')).toBe(true)
  })
})

describe('isCodeSearchShellCommand', () => {
  it('detects grep-like shell usage', () => {
    expect(isCodeSearchShellCommand('grep -r "foo" src')).toBe(true)
    expect(isCodeSearchShellCommand('rg "className" templates')).toBe(true)
    expect(isCodeSearchShellCommand('findstr /s "bg-white" *.html')).toBe(true)
    expect(isCodeSearchShellCommand('Get-ChildItem -Recurse | Select-String "tailwind"')).toBe(
      true
    )
  })

  it('allows normal build and server commands', () => {
    expect(isCodeSearchShellCommand('npm run dev')).toBe(false)
    expect(isCodeSearchShellCommand('python -m pytest')).toBe(false)
    expect(isCodeSearchShellCommand('npm test')).toBe(false)
  })
})

describe('assertSafeTerminalCommand', () => {
  it('blocks code search via shell', () => {
    expect(() => assertSafeTerminalCommand('grep -r foo .')).toThrow(/grep_workspace/)
  })
})
