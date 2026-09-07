import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ProjectMemoryService } from './project-memory-service'
import { ProjectMemoryStore } from './project-memory-store'

describe('ProjectMemoryService', () => {
  let userDataPath: string
  let workspacePath: string
  let service: ProjectMemoryService

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'memory-service-'))
    workspacePath = mkdtempSync(join(tmpdir(), 'memory-workspace-'))
    service = new ProjectMemoryService(userDataPath)
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    rmSync(workspacePath, { recursive: true, force: true })
  })

  it('merges workspace docs and dynamic entries into snapshot', () => {
    writeFileSync(join(workspacePath, 'AGENTS.md'), 'Always run tests')
    service.remember(workspacePath, {
      content: 'Indexer lives in electron/services/indexing',
      category: 'architecture',
      source: 'remember'
    })

    const snapshot = service.getSnapshot(workspacePath)
    expect(snapshot).toContain('AGENTS.md')
    expect(snapshot).toContain('Always run tests')
    expect(snapshot).toContain('Indexer lives in electron/services/indexing')
  })

  it('caches snapshot until invalidated', () => {
    const store = new ProjectMemoryStore(userDataPath)
    const cachedService = new ProjectMemoryService(userDataPath, store)

    store.remember(workspacePath, { content: 'First', category: 'note', source: 'remember' })
    const first = cachedService.getSnapshot(workspacePath)
    const cached = cachedService.getSnapshot(workspacePath)
    expect(cached).toBe(first)

    store.remember(workspacePath, { content: 'Second', category: 'note', source: 'remember' })
    expect(cachedService.getSnapshot(workspacePath)).toBe(first)

    cachedService.invalidate(workspacePath)
    const refreshed = cachedService.getSnapshot(workspacePath)
    expect(refreshed).not.toBe(first)
    expect(refreshed).toContain('Second')
  })

  it('filters read results by category and query', () => {
    service.remember(workspacePath, {
      content: 'Use Vitest for unit tests',
      category: 'convention',
      source: 'agent'
    })
    service.remember(workspacePath, {
      content: 'CI runs on GitHub Actions',
      category: 'architecture',
      source: 'agent'
    })

    const filtered = service.read(workspacePath, { category: 'convention', query: 'Vitest' })
    expect(filtered).toContain('Use Vitest for unit tests')
    expect(filtered).not.toContain('GitHub Actions')
  })
})
