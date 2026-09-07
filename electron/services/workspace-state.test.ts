import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getWorkspaceState } from './workspace-state'

describe('getWorkspaceState', () => {
  it('returns no-repo message for non-git directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws-state-'))
    const state = getWorkspaceState(dir)
    expect(state.isGitRepo).toBe(false)
    expect(state.formatted).toContain('not a repository')
  })

  it('detects git repo and formats branch section', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws-state-git-'))
    mkdirSync(join(dir, '.git'), { recursive: true })
    writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n')

    const state = getWorkspaceState(dir)
    expect(state.isGitRepo).toBe(true)
    expect(state.formatted).toContain('Branch:')
  })
})
