import { readFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type {
  CodebaseSearchHit,
  CodebaseSearchRequest,
  IndexProgress,
  IndexSettings,
  IndexStatus,
  ManifestEntry
} from './index-types'
import { DEFAULT_INDEX_SETTINGS } from './index-types'
import { IndexStore } from './index-store'
import { createDebouncedPathCollector, requeueIfBusy } from '../../lib/debounce-path-collector'
import { manifestEntryForFile, scanWorkspaceManifest } from './file-manifest'
import {
  filterWatcherPaths,
  getWorkspaceFileSet,
  invalidateWorkspaceFileCache,
  resolveWatcherFileSet
} from './workspace-files'
import { getWorkspaceIndexDir, getIndexDbPath, getVectorIndexPath, resolveSearchRoot } from './index-paths'
import { chunkFileContent } from './chunker'
import { parseSymbols } from './symbol-indexer'
import { VectorIndex } from './vector-index'
import { hybridSearch } from './hybrid-search'
import { ripgrepSearch } from './ripgrep-search'
import { AppErrorCode } from '../../lib/app-errors'
import type { SearchResult } from '../../types'

async function loadEmbeddingService(): Promise<typeof import('./embedding-service')> {
  return import('./embedding-service')
}

type ProgressListener = (progress: IndexProgress) => void
type StatusListener = (status: IndexStatus) => void

export class CodebaseIndexer {
  private workspacePath: string | null = null
  private settings: IndexSettings = DEFAULT_INDEX_SETTINGS
  private store: IndexStore | null = null
  private vectorIndex = new VectorIndex()
  private chunkById = new Map<number, import('./index-store').ChunkRow>()
  private status: IndexStatus = {
    state: 'idle',
    workspacePath: null,
    filesIndexed: 0,
    chunks: 0,
    symbols: 0,
    lastBuiltAt: null,
    progress: null,
    error: null,
    semanticReady: false,
    symbolReady: false
  }
  private building = false
  private cancelRequested = false
  private buildPromise: Promise<void> | null = null
  private progressListeners = new Set<ProgressListener>()
  private statusListeners = new Set<StatusListener>()
  private pendingPaths = createDebouncedPathCollector(1500, (paths) => {
    void this.flushIncremental(paths)
  })

  setSettings(settings: Partial<IndexSettings>): void {
    this.settings = { ...this.settings, ...settings }
  }

  getStatus(): IndexStatus {
    return { ...this.status }
  }

  onProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener)
    return () => this.progressListeners.delete(listener)
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  private emitProgress(progress: IndexProgress): void {
    this.status.progress = progress
    for (const listener of this.progressListeners) listener(progress)
  }

  private emitStatus(): void {
    const status = this.getStatus()
    for (const listener of this.statusListeners) listener(status)
  }

  private updateStatus(patch: Partial<IndexStatus>): void {
    this.status = { ...this.status, ...patch }
    this.emitStatus()
  }

  async setWorkspace(workspacePath: string | null, options?: { rebuild?: boolean }): Promise<void> {
    await this.stopActiveBuild()
    this.workspacePath = workspacePath
    this.pendingPaths.cancel()
    invalidateWorkspaceFileCache()
    this.store?.close()
    this.store = null
    this.vectorIndex.reset()
    this.chunkById.clear()

    if (!workspacePath) {
      this.updateStatus({
        state: 'idle',
        workspacePath: null,
        filesIndexed: 0,
        chunks: 0,
        symbols: 0,
        progress: null,
        error: null,
        semanticReady: false,
        symbolReady: false
      })
      return
    }

    const indexDir = getWorkspaceIndexDir(app.getPath('userData'), workspacePath)
    try {
      this.store = new IndexStore(getIndexDbPath(indexDir))
    } catch (err) {
      this.updateStatus({
        workspacePath,
        state: 'error',
        error: err instanceof Error ? err.message : String(err),
        progress: null
      })
      return
    }

    this.updateStatus({
      workspacePath,
      state: 'building',
      error: null,
      semanticReady: false,
      symbolReady: false
    })

    if (options?.rebuild) {
      this.store.resetAll()
    }

    if (this.settings.indexOnOpen || options?.rebuild) {
      await this.runFullIndex()
    } else {
      for (const chunk of this.store.getAllChunks()) {
        this.chunkById.set(chunk.id, chunk)
      }
      this.refreshCounts()
      this.updateStatus({
        state: 'ready',
        lastBuiltAt: this.store.getMeta('lastBuiltAt'),
        symbolReady: this.store.countSymbols() > 0,
        semanticReady: this.settings.semanticSearchEnabled && this.store.countChunks() > 0
      })
    }
  }

  async rebuild(): Promise<void> {
    if (!this.workspacePath || !this.store) {
      throw new Error('No workspace open for indexing')
    }

    await this.stopActiveBuild()

    this.pendingPaths.cancel()
    invalidateWorkspaceFileCache()
    this.chunkById.clear()
    this.vectorIndex.reset()
    this.store.resetAll()
    this.updateStatus({
      state: 'building',
      error: null,
      progress: null,
      semanticReady: false,
      symbolReady: false,
      filesIndexed: 0,
      chunks: 0,
      symbols: 0
    })
    await this.runFullIndex()
  }

  private async stopActiveBuild(): Promise<void> {
    if (!this.buildPromise) return
    this.cancelRequested = true
    await this.buildPromise
    this.cancelRequested = false
  }

  async filterChangedPaths(paths: string[]): Promise<string[]> {
    if (!this.workspacePath || !this.store) return []
    const indexed = new Set(this.store.listManifest().map((entry) => entry.path))
    const listed = await resolveWatcherFileSet(this.workspacePath, paths, indexed)
    return filterWatcherPaths(paths, listed, indexed)
  }

  queueChangedPaths(paths: string[]): void {
    for (const path of paths) this.pendingPaths.add(path)
  }

  private async flushIncremental(paths: string[]): Promise<void> {
    if (!this.workspacePath || !this.store) return
    if (requeueIfBusy(this.building, paths, (path) => this.pendingPaths.add(path))) return
    if (paths.length === 0) return

    const listed = await getWorkspaceFileSet(this.workspacePath)
    const maxBytes = this.settings.maxFileSizeKb * 1024
    for (const relPath of paths) {
      const entry = await manifestEntryForFile(this.workspacePath, relPath, maxBytes, listed)
      if (!entry) {
        this.store.purgeFile(relPath)
        continue
      }
      try {
        const content = await readFile(entry.absolutePath, 'utf-8')
        await this.indexFile(entry, content)
        this.store.upsertManifest([entry])
      } catch {
        this.store.purgeFile(relPath)
      }
    }

    this.refreshCounts()
  }

  private refreshCounts(): void {
    if (!this.store) return
    this.updateStatus({
      filesIndexed: this.store.countFiles(),
      chunks: this.store.countChunks(),
      symbols: this.store.countSymbols()
    })
  }

  private async runFullIndex(): Promise<void> {
    if (!this.workspacePath || !this.store) return
    await this.stopActiveBuild()

    const build = this.executeFullIndex()
    this.buildPromise = build
    try {
      await build
    } finally {
      if (this.buildPromise === build) {
        this.buildPromise = null
      }
    }
  }

  private async executeFullIndex(): Promise<void> {
    if (!this.workspacePath || !this.store) return
    this.building = true
    this.cancelRequested = false

    try {
      this.emitProgress({
        phase: 'scanning',
        phaseCode: AppErrorCode.INDEX_SCANNING,
        filesDone: 0,
        filesTotal: 0
      })
      invalidateWorkspaceFileCache()
      const manifest = await scanWorkspaceManifest(
        this.workspacePath,
        this.settings.maxFileSizeKb * 1024
      )
      invalidateWorkspaceFileCache()
      if (this.cancelRequested) return

      this.store.upsertManifest(manifest)

      this.emitProgress({
        phase: 'indexing_text',
        phaseCode: AppErrorCode.INDEX_INDEXING_FILES,
        filesDone: 0,
        filesTotal: manifest.length
      })

      const allChunks: Array<{ chunkId: number; vector: number[] }> = []
      let done = 0

      for (const entry of manifest) {
        if (this.cancelRequested) return
        const content = await readFile(entry.absolutePath, 'utf-8')
        const chunks = await this.indexFile(entry, content)
        done++
        if (done % 10 === 0 || done === manifest.length) {
          this.emitProgress({
            phase: 'indexing_text',
            phaseCode: AppErrorCode.INDEX_INDEXING_FILES,
            filesDone: done,
            filesTotal: manifest.length
          })
        }

        if (this.settings.semanticSearchEnabled && chunks.length > 0) {
          this.emitProgress({
            phase: 'embedding',
            phaseCode: AppErrorCode.INDEX_EMBEDDING,
            filesDone: done,
            filesTotal: manifest.length
          })
          const { embedTexts } = await loadEmbeddingService()
          const vectors = await embedTexts(
            this.settings.embeddingModel,
            chunks.map((chunk) => chunk.content),
            app.getPath('userData')
          )
          vectors.forEach((vector, index) => {
            allChunks.push({ chunkId: chunks[index].id, vector })
          })
        }
      }

      if (this.cancelRequested) return

      if (this.settings.semanticSearchEnabled && allChunks.length > 0) {
        this.emitProgress({ phase: 'vectors', filesDone: manifest.length, filesTotal: manifest.length })
        this.vectorIndex.rebuild(allChunks)
        const indexDir = getWorkspaceIndexDir(app.getPath('userData'), this.workspacePath)
        this.vectorIndex.save(getVectorIndexPath(indexDir))
      }

      if (this.cancelRequested) return

      const builtAt = new Date().toISOString()
      this.store.setMeta('lastBuiltAt', builtAt)
      this.refreshCounts()
      this.updateStatus({
        state: 'ready',
        lastBuiltAt: builtAt,
        semanticReady: this.settings.semanticSearchEnabled && allChunks.length > 0,
        symbolReady: true,
        progress: null,
        error: null
      })
    } catch (err) {
      if (!this.cancelRequested) {
        this.updateStatus({
          state: 'error',
          error: err instanceof Error ? err.message : String(err),
          progress: null
        })
      }
    } finally {
      const cancelled = this.cancelRequested
      this.building = false
      if (cancelled && this.status.state === 'building') {
        this.updateStatus({
          state: this.workspacePath && this.store ? 'ready' : 'idle',
          progress: null
        })
      }
    }
  }

  private async indexFile(
    entry: ManifestEntry,
    content: string
  ): Promise<Array<{ id: number; content: string }>> {
    if (!this.store) return []

    const symbols = await parseSymbols(content, entry.language)
    const symbolRanges = symbols.map((symbol) => ({
      name: symbol.name,
      startLine: symbol.startLine,
      endLine: symbol.endLine
    }))
    const chunks = chunkFileContent(content, symbolRanges)

    this.store.replaceFileFts(
      entry.path,
      chunks.map((chunk) => ({
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content
      }))
    )

    this.store.replaceFileSymbols(
      entry.path,
      symbols.map((symbol) => ({
        path: entry.path,
        name: symbol.name,
        kind: symbol.kind,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        content: symbol.content
      }))
    )

    const storedChunks = this.store.replaceFileChunks(
      entry.path,
      chunks.map((chunk) => ({
        id: 0,
        path: entry.path,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        symbolName: chunk.symbolName ?? null
      }))
    )

    for (const chunk of storedChunks) {
      this.chunkById.set(chunk.id, chunk)
    }

    return storedChunks.map((chunk) => ({ id: chunk.id, content: chunk.content }))
  }

  async search(request: CodebaseSearchRequest): Promise<CodebaseSearchHit[]> {
    if (!this.workspacePath) return []
    const root = resolveSearchRoot(this.workspacePath, request.root)

    return hybridSearch(
      request,
      root,
      this.store,
      this.vectorIndex,
      this.chunkById,
      async (query) => {
        const { embedTexts } = await loadEmbeddingService()
        const [vector] = await embedTexts(
          this.settings.embeddingModel,
          [query],
          app.getPath('userData')
        )
        return vector
      },
      {
        semanticReady: this.status.semanticReady,
        symbolReady: this.status.symbolReady
      }
    )
  }

  async listWorkspaceFiles(): Promise<string[]> {
    if (!this.workspacePath) return []

    if (this.store) {
      const manifest = this.store.listManifest()
      if (manifest.length > 0) {
        return manifest.map((entry) => join(this.workspacePath!, entry.path))
      }
    }

    const manifest = await scanWorkspaceManifest(
      this.workspacePath,
      this.settings.maxFileSizeKb * 1024
    )
    return manifest.map((entry) => join(this.workspacePath!, entry.path))
  }

  async searchFiles(query: string, root: string): Promise<SearchResult[]> {
    return ripgrepSearch(query, root, 100)
  }

  cancel(): void {
    this.cancelRequested = true
  }
}
