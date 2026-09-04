import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { IndexStore } from './index-store'
import { sqliteAvailableForTests } from './test-helpers'

describe.skipIf(!sqliteAvailableForTests())('IndexStore', () => {
  it('inserts and searches fts chunks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ora-index-'))
    const dbPath = join(dir, 'test.db')
    const store = new IndexStore(dbPath)

    store.replaceFileFts('src/agent.ts', [
      { startLine: 1, endLine: 2, content: 'approval tool handler' }
    ])

    const hits = store.searchFts('approval', 5)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].path).toBe('src/agent.ts')

    store.close()
    rmSync(dir, { recursive: true, force: true })
  })
})
