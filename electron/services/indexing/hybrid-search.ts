import type { CodebaseSearchHit, CodebaseSearchRequest } from './index-types'
import type { IndexStore, ChunkRow } from './index-store'
import { ripgrepSearch } from './ripgrep-search'
import type { VectorIndex } from './vector-index'

const RRF_K = 60

function rrfScore(rank: number, weight = 1): number {
  return weight / (RRF_K + rank)
}

function dedupeKey(hit: CodebaseSearchHit): string {
  return `${hit.path}:${hit.startLine}-${hit.endLine}`
}

export async function hybridSearch(
  request: CodebaseSearchRequest,
  workspaceRoot: string,
  store: IndexStore | null,
  vectorIndex: VectorIndex | null,
  chunkById: Map<number, ChunkRow>,
  embedQuery: (query: string) => Promise<number[]>,
  options: { semanticReady: boolean; symbolReady: boolean }
): Promise<CodebaseSearchHit[]> {
  const limit = request.limit ?? 20
  const mode = request.mode
  const query = request.query.trim()
  if (!query) return []

  const merged = new Map<string, CodebaseSearchHit>()

  const addHit = (hit: CodebaseSearchHit, rank: number, weight: number): void => {
    const key = dedupeKey(hit)
    const existing = merged.get(key)
    const scoreDelta = rrfScore(rank, weight)
    if (existing) {
      existing.score += scoreDelta
      return
    }
    merged.set(key, { ...hit, score: scoreDelta })
  }

  if (mode === 'text' || mode === 'hybrid') {
    if (store) {
      const ftsHits = store.searchFts(query, limit)
      ftsHits.forEach((hit, index) => {
        addHit(
          {
            path: hit.path,
            startLine: hit.startLine,
            endLine: hit.endLine,
            score: 0,
            channel: 'text',
            snippet: hit.snippet
          },
          index + 1,
          1
        )
      })
    }

    if (merged.size === 0) {
      const live = await ripgrepSearch(query, workspaceRoot, limit)
      live.forEach((hit, index) => {
        addHit(
          {
            path: hit.file,
            startLine: hit.line,
            endLine: hit.line,
            score: 0,
            channel: 'text',
            snippet: hit.content
          },
          index + 1,
          1
        )
      })
    }
  }

  if ((mode === 'symbol' || mode === 'hybrid') && store && options.symbolReady) {
    const symbols = store.searchSymbols(query, limit)
    symbols.forEach((symbol, index) => {
      addHit(
        {
          path: symbol.path,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
          score: 0,
          channel: 'symbol',
          snippet: symbol.content,
          symbolName: symbol.name,
          symbolKind: symbol.kind
        },
        index + 1,
        1.2
      )
    })
  }

  if ((mode === 'semantic' || mode === 'hybrid') && vectorIndex && options.semanticReady && chunkById.size > 0) {
    const queryVector = await embedQuery(query)
    const results = vectorIndex.search(queryVector, limit)
    results.forEach((result, index) => {
      const chunk = chunkById.get(result.chunkId)
      if (!chunk) return
      addHit(
        {
          path: chunk.path,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          score: 0,
          channel: 'semantic',
          snippet: chunk.content.slice(0, 200),
          symbolName: chunk.symbolName ?? undefined
        },
        index + 1,
        1
      )
    })
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
