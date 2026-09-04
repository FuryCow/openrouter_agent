import { describe, expect, it } from 'vitest'
import { join, resolve, win32 } from 'path'
import { tmpdir } from 'os'
import { resolveSearchRoot } from './index-paths'

describe('resolveSearchRoot', () => {
  const workspace = resolve(tmpdir(), 'openrouter-search-root-test')

  it('returns workspace when root is omitted', () => {
    expect(resolveSearchRoot(workspace)).toBe(workspace)
  })

  it('joins relative subdirectories', () => {
    expect(resolveSearchRoot(workspace, 'minigame')).toBe(join(workspace, 'minigame'))
  })

  it('does not double absolute paths', () => {
    expect(resolveSearchRoot(workspace, workspace)).toBe(workspace)
  })

  it('treats Windows drive paths as absolute', () => {
    const winWorkspace = win32.resolve('F:\\test')
    expect(resolveSearchRoot(winWorkspace, winWorkspace)).toBe(win32.normalize(winWorkspace))
    expect(resolveSearchRoot(winWorkspace, 'minigame')).toBe(win32.join(winWorkspace, 'minigame'))
  })
})
