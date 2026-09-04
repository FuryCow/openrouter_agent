import { describe, expect, it } from 'vitest'
import { isPathInside } from './workspace-safety'

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
