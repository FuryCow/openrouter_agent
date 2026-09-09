import { describe, expect, it } from 'vitest'
import { buildAgentContextFiles } from './agentContext'
import type { EditorTab } from '@/stores/fileStore'

const tabs: EditorTab[] = [
  { path: 'F:/proj/a.ts', content: 'a', language: 'typescript', isDirty: false },
  { path: 'F:/proj/b.ts', content: 'b', language: 'typescript', isDirty: false },
  { path: 'F:/proj/c.ts', content: 'c', language: 'typescript', isDirty: false }
]

describe('buildAgentContextFiles', () => {
  it('prioritizes pinned and active tab', () => {
    const files = buildAgentContextFiles(tabs, {
      pinnedPaths: ['F:/proj/c.ts'],
      excludedPaths: [],
      activeTabPath: 'F:/proj/a.ts'
    })
    expect(files.map((f) => f.path)).toEqual(['F:/proj/c.ts', 'F:/proj/a.ts', 'F:/proj/b.ts'])
    expect(files[0]?.pinned).toBe(true)
  })

  it('excludes removed context paths', () => {
    const files = buildAgentContextFiles(tabs, {
      pinnedPaths: [],
      excludedPaths: ['F:/proj/b.ts'],
      activeTabPath: null
    })
    expect(files.map((f) => f.path)).toEqual(['F:/proj/a.ts', 'F:/proj/c.ts'])
  })

  it('limits file count', () => {
    const manyTabs = Array.from({ length: 12 }, (_, i) => ({
      path: `F:/proj/f${i}.ts`,
      content: `${i}`,
      language: 'typescript',
      isDirty: false
    }))
    const files = buildAgentContextFiles(manyTabs, {
      pinnedPaths: [],
      excludedPaths: [],
      activeTabPath: null
    })
    expect(files).toHaveLength(8)
  })
})
