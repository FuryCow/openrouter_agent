import { describe, expect, it } from 'vitest'
import { hybridSearch } from './hybrid-search'
import { IndexStore } from './index-store'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { VectorIndex } from './vector-index'
import { sqliteAvailableForTests } from './test-helpers'

describe.skipIf(!sqliteAvailableForTests())('hybridSearch', () => {
  it('merges text and symbol hits with RRF', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ora-hybrid-'))
    const store = new IndexStore(join(dir, 'test.db'))
    store.replaceFileFts('src/agent.ts', [
      { startLine: 10, endLine: 10, content: 'waitForApproval tool call' }
    ])
    store.replaceFileSymbols('src/agent.ts', [
      {
        path: 'src/agent.ts',
        name: 'waitForApproval',
        kind: 'function',
        startLine: 10,
        endLine: 12,
        content: 'function waitForApproval'
      }
    ])

    const hits = await hybridSearch(
      { query: 'approval', mode: 'hybrid', limit: 5 },
      dir,
      store,
      new VectorIndex(),
      new Map(),
      async () => [],
      { semanticReady: false, symbolReady: true }
    )

    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].path).toBe('src/agent.ts')

    store.close()
    rmSync(dir, { recursive: true, force: true })
  })
})
