import { describe, expect, it } from 'vitest'
import type { ToolCallInfo } from '@/types'
import type { TimelineToolItem } from '@/lib/timeline'
import { buildToolSummarySegments } from './toolGroupSummary'

function toolItem(id: string, name: string, args = '{}'): TimelineToolItem {
  const toolCall: ToolCallInfo = {
    id,
    name,
    arguments: args,
    status: 'done'
  }
  return { id, type: 'tool', toolCall }
}

describe('buildToolSummarySegments', () => {
  it('keeps up to two identical tools as separate entries', () => {
    const tools = [
      toolItem('1', 'run_terminal'),
      toolItem('2', 'run_terminal')
    ]

    const segments = buildToolSummarySegments(tools)
    expect(segments).toHaveLength(2)
    expect(segments.every((segment) => segment.kind === 'single')).toBe(true)
  })

  it('collapses three or more identical tools into one compact segment', () => {
    const tools = [
      toolItem('1', 'run_terminal'),
      toolItem('2', 'run_terminal'),
      toolItem('3', 'run_terminal'),
      toolItem('4', 'run_terminal')
    ]

    const segments = buildToolSummarySegments(tools)
    expect(segments).toEqual([
      {
        kind: 'compact',
        key: 'run_terminal',
        toolName: 'run_terminal',
        count: 4,
        filePath: undefined
      }
    ])
  })

  it('groups mixed tools independently while preserving first-seen order', () => {
    const tools = [
      toolItem('1', 'search_replace', JSON.stringify({ path: '.gitignore' })),
      toolItem('2', 'run_terminal'),
      toolItem('3', 'run_terminal'),
      toolItem('4', 'run_terminal'),
      toolItem('5', 'run_terminal')
    ]

    const segments = buildToolSummarySegments(tools)
    expect(segments.map((segment) => segment.kind)).toEqual(['single', 'compact'])
    expect(segments[0]?.kind).toBe('single')
    expect(segments[1]).toMatchObject({
      kind: 'compact',
      toolName: 'run_terminal',
      count: 4
    })
  })

  it('groups repeated file edits by tool name and path', () => {
    const tools = [
      toolItem('1', 'search_replace', JSON.stringify({ path: 'src/a.ts' })),
      toolItem('2', 'search_replace', JSON.stringify({ path: 'src/a.ts' })),
      toolItem('3', 'search_replace', JSON.stringify({ path: 'src/a.ts' }))
    ]

    const segments = buildToolSummarySegments(tools)
    expect(segments).toEqual([
      {
        kind: 'compact',
        key: 'search_replace:src/a.ts',
        toolName: 'search_replace',
        count: 3,
        filePath: 'src/a.ts'
      }
    ])
  })
})
