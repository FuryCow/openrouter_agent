import { describe, expect, it } from 'vitest'
import { resolveWorkspacePath } from './workspaceReady'

describe('resolveWorkspacePath', () => {
  it('waits until hydrated', () => {
    expect(resolveWorkspacePath(false, null, '/tmp/project')).toBeUndefined()
  })

  it('waits for fileStore when settings already have a workspace', () => {
    expect(resolveWorkspacePath(true, null, '/tmp/project')).toBeUndefined()
  })

  it('returns resolved workspace path', () => {
    expect(resolveWorkspacePath(true, '/tmp/a', '/tmp/b')).toBe('/tmp/a')
    expect(resolveWorkspacePath(true, null, null)).toBeNull()
  })
})
