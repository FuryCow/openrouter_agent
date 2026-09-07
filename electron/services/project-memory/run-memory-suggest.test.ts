import { describe, expect, it } from 'vitest'
import { suggestMemoryFromRun } from './run-memory-suggest'
import type { TimelineItem } from '../../types'

describe('suggestMemoryFromRun', () => {
  it('suggests changed file paths from completed file tools', () => {
    const timeline: TimelineItem[] = [
      {
        type: 'tool',
        id: 't1',
        toolCall: {
          id: 'c1',
          name: 'write_file',
          arguments: '{}',
          status: 'done',
          filePath: 'src/app.ts'
        }
      },
      {
        type: 'tool',
        id: 't2',
        toolCall: {
          id: 'c2',
          name: 'search_replace',
          arguments: '{}',
          status: 'done',
          filePath: 'src/util.ts'
        }
      }
    ]

    const suggestions = suggestMemoryFromRun(timeline, 'Updated app and util.')
    expect(suggestions.some((entry) => entry.content.includes('src/app.ts'))).toBe(true)
    expect(suggestions.some((entry) => entry.content.includes('src/util.ts'))).toBe(true)
  })

  it('suggests summary when agent did not update memory', () => {
    const timeline: TimelineItem[] = []
    const finalContent =
      'Implemented workspace-scoped chat persistence with migration from legacy global chats.'

    const suggestions = suggestMemoryFromRun(timeline, finalContent)
    expect(suggestions.some((entry) => entry.category === 'decision')).toBe(true)
    expect(suggestions.some((entry) => entry.content.includes('workspace-scoped'))).toBe(true)
  })

  it('skips summary suggestion when agent already wrote memory', () => {
    const timeline: TimelineItem[] = [
      {
        type: 'tool',
        id: 't1',
        toolCall: {
          id: 'c1',
          name: 'update_project_memory',
          arguments: '{}',
          status: 'done'
        }
      }
    ]

    const suggestions = suggestMemoryFromRun(
      timeline,
      'Long enough final answer about architecture decisions that would normally be suggested.'
    )

    expect(suggestions.every((entry) => entry.category !== 'decision')).toBe(true)
  })

  it('returns at most three suggestions', () => {
    const timeline: TimelineItem[] = Array.from({ length: 8 }, (_, index) => ({
      type: 'tool' as const,
      id: `t${index}`,
      toolCall: {
        id: `c${index}`,
        name: 'write_file',
        arguments: '{}',
        status: 'done' as const,
        filePath: `src/file-${index}.ts`
      }
    }))

    const suggestions = suggestMemoryFromRun(
      timeline,
      '- First bullet\n- Second bullet\n- Third bullet\n- Fourth bullet'
    )

    expect(suggestions.length).toBeLessThanOrEqual(3)
  })
})
