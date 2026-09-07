import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ProjectMemoryStore } from './project-memory-store'

describe('ProjectMemoryStore', () => {
  let userDataPath: string
  let store: ProjectMemoryStore
  const workspace = join(tmpdir(), 'demo-workspace')

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'memory-store-'))
    store = new ProjectMemoryStore(userDataPath)
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('starts empty', () => {
    expect(store.listEntries(workspace)).toEqual([])
  })

  it('appends and persists entries', () => {
    const entry = store.remember(workspace, {
      content: 'Use Zustand for UI state',
      category: 'decision',
      source: 'remember'
    })

    expect(entry.id).toBeTruthy()
    expect(store.listEntries(workspace)).toHaveLength(1)
    expect(store.listEntries(workspace)[0].content).toBe('Use Zustand for UI state')
  })

  it('updates and deletes entries', () => {
    const entry = store.update(workspace, {
      action: 'append',
      content: 'First note',
      category: 'note',
      source: 'agent'
    })
    expect(entry?.content).toBe('First note')

    const updated = store.update(workspace, {
      action: 'update',
      id: entry?.id,
      content: 'Updated note'
    })
    expect(updated?.content).toBe('Updated note')

    store.update(workspace, { action: 'delete', id: entry?.id })
    expect(store.listEntries(workspace)).toEqual([])
  })

  it('replaces all entries via saveEntries', () => {
    store.remember(workspace, { content: 'Old entry', category: 'note', source: 'user' })
    store.saveEntries(workspace, [
      {
        id: 'fixed-id',
        category: 'architecture',
        content: 'Electron main owns IPC',
        source: 'user',
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ])

    const entries = store.listEntries(workspace)
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('fixed-id')
  })
})
