import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { isProjectMemoryDocPath, loadWorkspaceDocs } from './workspace-docs'

describe('workspace-docs', () => {
  let workspacePath: string

  beforeEach(() => {
    workspacePath = mkdtempSync(join(tmpdir(), 'workspace-docs-'))
  })

  afterEach(() => {
    rmSync(workspacePath, { recursive: true, force: true })
  })

  it('loads AGENTS.md and .openrouter markdown files', () => {
    writeFileSync(join(workspacePath, 'AGENTS.md'), '# Agent rules\nUse TypeScript')
    mkdirSync(join(workspacePath, '.openrouter'))
    writeFileSync(join(workspacePath, '.openrouter', 'rules.md'), '# Local rules')

    const docs = loadWorkspaceDocs(workspacePath)
    expect(docs.map((doc) => doc.path)).toEqual(['AGENTS.md', '.openrouter/rules.md'])
  })

  it('detects project memory doc paths', () => {
    expect(isProjectMemoryDocPath('AGENTS.md')).toBe(true)
    expect(isProjectMemoryDocPath('.openrouter/rules.md')).toBe(true)
    expect(isProjectMemoryDocPath('.cursor/rules/style.mdc')).toBe(true)
    expect(isProjectMemoryDocPath('src/index.ts')).toBe(false)
  })

  it('loads .cursor/rules markdown when enabled', () => {
    writeFileSync(join(workspacePath, 'AGENTS.md'), '# Agent rules')
    mkdirSync(join(workspacePath, '.cursor', 'rules'), { recursive: true })
    writeFileSync(
      join(workspacePath, '.cursor', 'rules', 'style.mdc'),
      '---\ntitle: Style\n---\nUse 2-space indent'
    )

    const docs = loadWorkspaceDocs(workspacePath)
    expect(docs.map((doc) => doc.path)).toEqual(['AGENTS.md', '.cursor/rules/style.mdc'])
    expect(docs[1].content).toBe('Use 2-space indent')
  })

  it('skips .cursor/rules when includeCursorRules is false', () => {
    mkdirSync(join(workspacePath, '.cursor', 'rules'), { recursive: true })
    writeFileSync(join(workspacePath, '.cursor', 'rules', 'style.md'), '# Style')

    const docs = loadWorkspaceDocs(workspacePath, { includeCursorRules: false })
    expect(docs).toHaveLength(0)
  })
})
