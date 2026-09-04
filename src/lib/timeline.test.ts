import { describe, expect, it } from 'vitest'
import { appendTimelineChunk, upsertTimelineTool } from './timeline'

describe('timeline', () => {
  it('appends text chunks to the same item', () => {
    const first = appendTimelineChunk([], 'text', 'hello ')
    const second = appendTimelineChunk(first, 'text', 'world')
    expect(second).toHaveLength(1)
    expect(second[0].type).toBe('text')
    if (second[0].type === 'text') {
      expect(second[0].content).toBe('hello world')
    }
  })

  it('upserts tool calls by id', () => {
    const base = upsertTimelineTool([], {
      id: 't1',
      name: 'read_file',
      arguments: '{}',
      status: 'running'
    })
    const updated = upsertTimelineTool(base, {
      id: 't1',
      name: 'read_file',
      arguments: '{}',
      status: 'done',
      result: 'ok'
    })
    expect(updated).toHaveLength(1)
    expect(updated[0].type).toBe('tool')
    if (updated[0].type === 'tool') {
      expect(updated[0].toolCall.status).toBe('done')
    }
  })
})
