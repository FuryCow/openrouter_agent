import { describe, expect, it } from 'vitest'
import { appendTimelineChunk, segmentTimeline, upsertTimelineTool } from './timeline'

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

  it('folds stray text into the current reasoning block', () => {
    const thinking = appendTimelineChunk([], 'reasoning', 'Принято — масштаб')
    const folded = appendTimelineChunk(thinking, 'text', 'ируем от леса')
    expect(folded).toHaveLength(1)
    expect(folded[0].type).toBe('reasoning')
    if (folded[0].type === 'reasoning') {
      expect(folded[0].content).toBe('Принято — масштабируем от леса')
    }
  })

  it('does not fold a markdown list or a new line into reasoning', () => {
    const thinking = appendTimelineChunk([], 'reasoning', 'notes')
    const list = appendTimelineChunk(thinking, 'text', '- Step 1')
    expect(list.map((item) => item.type)).toEqual(['reasoning', 'text'])
    const paragraph = appendTimelineChunk(thinking, 'text', '\nPlan body')
    expect(paragraph.map((item) => item.type)).toEqual(['reasoning', 'text'])
  })

  it('starts text after a markdown heading', () => {
    const thinking = appendTimelineChunk([], 'reasoning', 'notes')
    const next = appendTimelineChunk(thinking, 'text', '# Plan\nDo it')
    expect(next.map((item) => item.type)).toEqual(['reasoning', 'text'])
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

  it('groups consecutive tool calls into one segment', () => {
    const timeline = [
      { id: 'r1', type: 'reasoning' as const, content: 'think' },
      { id: 't1', type: 'tool' as const, toolCall: { id: 't1', name: 'read_file', arguments: '{}', status: 'done' as const } },
      { id: 't2', type: 'tool' as const, toolCall: { id: 't2', name: 'write_file', arguments: '{}', status: 'running' as const } },
      { id: 'x1', type: 'text' as const, content: 'done' },
      { id: 't3', type: 'tool' as const, toolCall: { id: 't3', name: 'grep_workspace', arguments: '{}', status: 'done' as const } }
    ]

    const segments = segmentTimeline(timeline)
    expect(segments).toHaveLength(4)
    expect(segments[0].kind).toBe('reasoning')
    expect(segments[1].kind).toBe('tools')
    if (segments[1].kind === 'tools') {
      expect(segments[1].items).toHaveLength(2)
    }
    expect(segments[2].kind).toBe('text')
    expect(segments[3].kind).toBe('tools')
    if (segments[3].kind === 'tools') {
      expect(segments[3].items).toHaveLength(1)
    }
  })
})
