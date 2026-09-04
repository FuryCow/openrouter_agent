import { existsSync } from 'fs'
import type { HierarchicalNSW } from 'hnswlib-node'
import { createHnswIndex, loadHnswIndex } from './native-hnsw'

const DIMENSION = 384

export interface VectorSearchResult {
  chunkId: number
  distance: number
}

export class VectorIndex {
  private index: HierarchicalNSW | null = null
  private nextLabel = 0
  private labelToChunkId = new Map<number, number>()

  ensureIndex(): HierarchicalNSW {
    if (!this.index) {
      this.index = createHnswIndex('cosine', DIMENSION)
    }
    return this.index
  }

  reset(): void {
    this.index = null
    this.nextLabel = 0
    this.labelToChunkId.clear()
  }

  rebuild(vectors: Array<{ chunkId: number; vector: number[] }>): void {
    this.reset()
    const index = this.ensureIndex()
    if (vectors.length === 0) return

    index.resizeIndex(vectors.length)
    for (const item of vectors) {
      const label = this.nextLabel++
      this.labelToChunkId.set(label, item.chunkId)
      index.addPoint(item.vector, label)
    }
  }

  addPoint(chunkId: number, vector: number[]): void {
    const index = this.ensureIndex()
    const label = this.nextLabel++
    this.labelToChunkId.set(label, chunkId)
    index.addPoint(vector, label)
  }

  search(query: number[], limit = 20): VectorSearchResult[] {
    if (!this.index || this.labelToChunkId.size === 0) return []
    const neighbors = this.index.searchKnn(query, Math.min(limit, this.labelToChunkId.size))
    return neighbors.neighbors.map((label, index) => ({
      chunkId: this.labelToChunkId.get(label) ?? -1,
      distance: neighbors.distances[index] ?? 0
    })).filter((item) => item.chunkId >= 0)
  }

  save(filePath: string): void {
    if (!this.index) return
    this.index.writeIndexSync(filePath)
  }

  load(filePath: string, chunkIdByLabel: Map<number, number>): void {
    if (!existsSync(filePath)) return
    this.index = loadHnswIndex(filePath, 'cosine', DIMENSION)
    this.labelToChunkId = chunkIdByLabel
    this.nextLabel = chunkIdByLabel.size
  }
}
