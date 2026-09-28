import { describe, expect, it } from 'vitest'
import { ripgrepExecutablePath } from './ripgrep'

describe('ripgrepExecutablePath', () => {
  it('points a packaged binary at the unpacked copy', () => {
    expect(
      ripgrepExecutablePath(
        'C:\\Program\\resources\\app.asar\\node_modules\\@vscode\\ripgrep-win32-x64\\bin\\rg.exe'
      )
    ).toBe(
      'C:\\Program\\resources\\app.asar.unpacked\\node_modules\\@vscode\\ripgrep-win32-x64\\bin\\rg.exe'
    )
  })

  it('leaves a dev install path alone', () => {
    const dev = 'F:\\openrouter_agent\\node_modules\\@vscode\\ripgrep-win32-x64\\bin\\rg.exe'
    expect(ripgrepExecutablePath(dev)).toBe(dev)
  })
})
