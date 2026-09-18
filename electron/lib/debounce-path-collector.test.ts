import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDebouncedPathCollector } from './debounce-path-collector'

describe('createDebouncedPathCollector', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces path flushes', () => {
    vi.useFakeTimers()
    const flushed: string[][] = []
    const collector = createDebouncedPathCollector(300, (paths) => flushed.push(paths))

    collector.add('src/a.ts')
    collector.add('src/b.ts')
    expect(flushed).toHaveLength(0)

    vi.advanceTimersByTime(300)
    expect(flushed).toEqual([['src/a.ts', 'src/b.ts']])
  })

  it('cancel clears pending paths', () => {
    vi.useFakeTimers()
    const flushed: string[][] = []
    const collector = createDebouncedPathCollector(300, (paths) => flushed.push(paths))

    collector.add('src/a.ts')
    collector.cancel()
    vi.advanceTimersByTime(300)
    expect(flushed).toHaveLength(0)
  })
})
