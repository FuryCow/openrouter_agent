import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => (globalThis as { __indexUserData?: string }).__indexUserData ?? ''
  }
}))

vi.mock('./index-store', () => {
  class IndexStore {
    private files = new Map<string, { path: string }>()
    private chunks: Array<{
      id: number
      path: string
      startLine: number
      endLine: number
      content: string
      symbolName: string | null
    }> = []
    private meta = new Map<string, string>()
    private nextId = 1

    constructor(_dbPath: string) {}

    close(): void {}

    resetAll(): void {
      this.files.clear()
      this.chunks = []
      this.meta.clear()
    }

    getAllChunks() {
      return this.chunks
    }

    getMeta(key: string): string | null {
      return this.meta.get(key) ?? null
    }

    countSymbols(): number {
      return 0
    }

    countChunks(): number {
      return this.chunks.length
    }

    countFiles(): number {
      return this.files.size
    }

    listManifest() {
      return [...this.files.values()]
    }

    purgeFile(path: string): void {
      this.files.delete(path)
      this.chunks = this.chunks.filter((chunk) => chunk.path !== path)
    }

    upsertManifest(entries: Array<{ path: string }>): void {
      for (const entry of entries) this.files.set(entry.path, entry)
    }

    setMeta(key: string, value: string): void {
      this.meta.set(key, value)
    }

    replaceFileFts(): void {}

    replaceFileSymbols(): void {}

    replaceFileChunks(
      path: string,
      chunks: Array<{
        path: string
        startLine: number
        endLine: number
        content: string
        symbolName: string | null
      }>
    ) {
      this.chunks = this.chunks.filter((chunk) => chunk.path !== path)
      const stored = chunks.map((chunk) => ({ ...chunk, id: this.nextId++ }))
      this.chunks.push(...stored)
      return stored
    }

    searchFts(query: string) {
      const needle = query.toLowerCase()
      return this.chunks
        .filter((chunk) => chunk.content.toLowerCase().includes(needle))
        .map((chunk) => ({
          path: chunk.path,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          snippet: chunk.content,
          rank: 0
        }))
    }
  }

  return { IndexStore }
})

vi.mock('./file-manifest', async () => {
  const actual = await vi.importActual<typeof import('./file-manifest')>('./file-manifest')
  return {
    ...actual,
    scanWorkspaceManifest: async (...args: Parameters<typeof actual.scanWorkspaceManifest>) => {
      await new Promise((resolve) => setTimeout(resolve, 40))
      return actual.scanWorkspaceManifest(...args)
    }
  }
})

import { CodebaseIndexer } from './codebase-indexer'

function project(name: string, file: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), `index-${name}-`))
  mkdirSync(join(dir, 'src'))
  writeFileSync(join(dir, 'src', file), body)
  return dir
}

describe('switching folders while indexing', () => {
  const dirs: string[] = []
  let indexer: CodebaseIndexer | null = null

  afterEach(async () => {
    await indexer?.setWorkspace(null)
    indexer = null
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function openIndexer(): CodebaseIndexer {
    const userData = mkdtempSync(join(tmpdir(), 'index-user-'))
    dirs.push(userData)
    ;(globalThis as { __indexUserData?: string }).__indexUserData = userData
    const next = new CodebaseIndexer()
    next.setSettings({ indexOnOpen: true, semanticSearchEnabled: false })
    indexer = next
    return next
  }

  it('searches the folder that is open now after a switch', async () => {
    const camera = project('camera', 'Camera.ts', 'export const cameraFocus = 1')
    const audio = project('audio', 'Mixer.ts', 'export const mixerGain = 2')
    dirs.push(camera, audio)
    const index = openIndexer()

    const opening = index.setWorkspace(camera)
    await vi.waitFor(() => {
      expect(index.getStatus().state).toBe('building')
    })
    const switched = index.setWorkspace(audio)
    await opening
    await switched

    const status = index.getStatus()
    expect(status.workspacePath).toBe(audio)
    expect(status.state).toBe('ready')

    const hits = await index.search({ query: 'mixerGain', mode: 'text', limit: 5 })
    expect(hits.some((hit) => hit.snippet.includes('mixerGain'))).toBe(true)
    expect(hits.some((hit) => hit.snippet.includes('cameraFocus'))).toBe(false)
  })

  it('does not stay on building after the index is cancelled', async () => {
    const camera = project('cancel', 'Camera.ts', 'export const cameraFocus = 1')
    dirs.push(camera)
    const index = openIndexer()

    const opening = index.setWorkspace(camera)
    await vi.waitFor(() => {
      expect(index.getStatus().state).toBe('building')
    })
    index.cancel()
    await opening

    expect(index.getStatus().state).not.toBe('building')
    expect(index.getStatus().workspacePath).toBe(camera)
  })
})
