import { describe, expect, it } from 'vitest'
import {
  appendTimelineChunk,
  flattenActivityItems,
  groupTimelineTools,
  segmentTimeline,
  upsertTimelineTool
} from './timeline'

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

  it('keeps streamed text as a separate text item instead of folding it into reasoning', () => {
    const thinking = appendTimelineChunk([], 'reasoning', 'Принято — масштаб')
    const folded = appendTimelineChunk(thinking, 'text', 'ируем от леса')
    expect(folded.map((item) => item.type)).toEqual(['reasoning', 'text'])
    if (folded[1].type === 'text') {
      expect(folded[1].content).toBe('ируем от леса')
    }
  })

  it('does not fold a markdown list or a new line into reasoning', () => {
    const thinking = appendTimelineChunk([], 'reasoning', 'notes')
    const list = appendTimelineChunk(thinking, 'text', '- Step 1')
    expect(list.map((item) => item.type)).toEqual(['reasoning', 'text'])
    const paragraph = appendTimelineChunk(thinking, 'text', '\nPlan body')
    expect(paragraph.map((item) => item.type)).toEqual(['reasoning', 'text'])
  })

  it('does not fold numbered lists, star lists, headings, or blank chunks', () => {
    const thinking = appendTimelineChunk([], 'reasoning', 'notes')
    expect(appendTimelineChunk(thinking, 'text', '* item').map((item) => item.type)).toEqual([
      'reasoning',
      'text'
    ])
    expect(appendTimelineChunk(thinking, 'text', '1. step').map((item) => item.type)).toEqual([
      'reasoning',
      'text'
    ])
    expect(appendTimelineChunk(thinking, 'text', '  # Title').map((item) => item.type)).toEqual([
      'reasoning',
      'text'
    ])
    expect(appendTimelineChunk(thinking, 'text', '   ').map((item) => item.type)).toEqual([
      'reasoning',
      'text'
    ])
    expect(appendTimelineChunk(thinking, 'text', '')).toBe(thinking)
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

  it('passes tool-group items through as their own segment (no silent drop)', () => {
    const group = {
      id: 'tool-group-t1-t3',
      type: 'tool-group' as const,
      toolName: 'run_terminal',
      count: 3,
      items: [
        { id: 't1', type: 'tool' as const, toolCall: { id: 't1', name: 'run_terminal', arguments: '{}', status: 'done' as const } },
        { id: 't2', type: 'tool' as const, toolCall: { id: 't2', name: 'run_terminal', arguments: '{}', status: 'done' as const } },
        { id: 't3', type: 'tool' as const, toolCall: { id: 't3', name: 'run_terminal', arguments: '{}', status: 'done' as const } }
      ]
    }
    const timeline = [
      { id: 'r1', type: 'reasoning' as const, content: 'think' },
      group,
      { id: 'x1', type: 'text' as const, content: 'done' }
    ]

    const segments = segmentTimeline(timeline)
    expect(segments).toHaveLength(3)
    expect(segments[0].kind).toBe('reasoning')
    expect(segments[1].kind).toBe('tool-group')
    if (segments[1].kind === 'tool-group') {
      expect(segments[1].item.count).toBe(3)
      expect(segments[1].item.toolName).toBe('run_terminal')
    }
    expect(segments[2].kind).toBe('text')
  })
})

describe('groupTimelineTools', () => {
  function toolItem(id: string, name: string, args = '{}') {
    return { id, type: 'tool' as const, toolCall: { id, name, arguments: args, status: 'done' as const } }
  }

  it('collapses a run of three or more same-tool calls into one group item', () => {
    const timeline = [
      toolItem('t1', 'run_terminal'),
      toolItem('t2', 'run_terminal'),
      toolItem('t3', 'run_terminal'),
      toolItem('t4', 'run_terminal')
    ]

    const grouped = groupTimelineTools(timeline)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].type).toBe('tool-group')
    if (grouped[0].type === 'tool-group') {
      expect(grouped[0].toolName).toBe('run_terminal')
      expect(grouped[0].count).toBe(4)
      expect(grouped[0].items).toHaveLength(4)
    }
  })

  it('keeps runs shorter than three as individual tool items', () => {
    const timeline = [
      toolItem('t1', 'run_terminal'),
      toolItem('t2', 'run_terminal'),
      toolItem('t3', 'write_file')
    ]

    const grouped = groupTimelineTools(timeline)
    expect(grouped.map((item) => item.type)).toEqual(['tool', 'tool', 'tool'])
  })

  it('breaks runs on a different tool name', () => {
    const timeline = [
      toolItem('t1', 'run_terminal'),
      toolItem('t2', 'run_terminal'),
      toolItem('t3', 'run_terminal'),
      toolItem('t4', 'write_file'),
      toolItem('t5', 'run_terminal'),
      toolItem('t6', 'run_terminal'),
      toolItem('t7', 'run_terminal')
    ]

    const grouped = groupTimelineTools(timeline)
    expect(grouped.map((item) => item.type)).toEqual(['tool-group', 'tool', 'tool-group'])
    if (grouped[0].type === 'tool-group') {
      expect(grouped[0].count).toBe(3)
    }
    if (grouped[2].type === 'tool-group') {
      expect(grouped[2].count).toBe(3)
    }
  })

  it('breaks runs on non-tool items', () => {
    const timeline = [
      toolItem('t1', 'run_terminal'),
      toolItem('t2', 'run_terminal'),
      toolItem('t3', 'run_terminal'),
      { id: 'x1', type: 'text' as const, content: 'interlude' },
      toolItem('t4', 'run_terminal'),
      toolItem('t5', 'run_terminal'),
      toolItem('t6', 'run_terminal')
    ]

    const grouped = groupTimelineTools(timeline)
    expect(grouped.map((item) => item.type)).toEqual(['tool-group', 'text', 'tool-group'])
  })

  it('groups file edits by tool name and resolved file path', () => {
    const pathArgs = (path: string): string => JSON.stringify({ path })
    const timeline = [
      toolItem('t1', 'search_replace', pathArgs('src/a.ts')),
      toolItem('t2', 'search_replace', pathArgs('src/a.ts')),
      toolItem('t3', 'search_replace', pathArgs('src/a.ts')),
      toolItem('t4', 'search_replace', pathArgs('src/b.ts'))
    ]

    const grouped = groupTimelineTools(timeline)
    expect(grouped.map((item) => item.type)).toEqual(['tool-group', 'tool'])
    if (grouped[0].type === 'tool-group') {
      expect(grouped[0].count).toBe(3)
      expect(grouped[0].toolName).toBe('search_replace')
    }
  })

  it('does not group file edits to different files', () => {
    const pathArgs = (path: string): string => JSON.stringify({ path })
    const timeline = [
      toolItem('t1', 'write_file', pathArgs('src/a.ts')),
      toolItem('t2', 'write_file', pathArgs('src/b.ts')),
      toolItem('t3', 'write_file', pathArgs('src/c.ts'))
    ]

    const grouped = groupTimelineTools(timeline)
    expect(grouped.map((item) => item.type)).toEqual(['tool', 'tool', 'tool'])
  })

  it('keeps a single tool item untouched', () => {
    const timeline = [toolItem('t1', 'read_file')]
    const grouped = groupTimelineTools(timeline)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].type).toBe('tool')
  })

  it('handles an empty timeline', () => {
    expect(groupTimelineTools([])).toEqual([])
  })
})

describe('flattenActivityItems', () => {
  function toolItem(id: string, name: string, args = '{}') {
    return { id, type: 'tool' as const, toolCall: { id, name, arguments: args, status: 'done' as const } }
  }

  // Regression: the expanded body of a "Search × 3" row used to re-run
  // groupTimelineTools on the group's own members, collapsing them back
  // into another "Search × 3" row — clicking expanded the same group
  // forever. The body must unwrap groups instead of re-grouping.
  it('unwraps a tool-group into its member calls instead of re-grouping them', () => {
    const group = {
      id: 'tool-group-t1-t3',
      type: 'tool-group' as const,
      toolName: 'codebase_search',
      count: 3,
      items: [
        toolItem('t1', 'codebase_search'),
        toolItem('t2', 'codebase_search'),
        toolItem('t3', 'codebase_search')
      ]
    }

    const flat = flattenActivityItems([group])
    expect(flat.map((item) => item.type)).toEqual(['tool', 'tool', 'tool'])
    expect(flat.map((item) => (item.type === 'tool' ? item.toolCall.id : null))).toEqual([
      't1',
      't2',
      't3'
    ])
  })

  it('keeps reasoning and text items as-is', () => {
    const items = [
      { id: 'r1', type: 'reasoning' as const, content: 'think' },
      { id: 'x1', type: 'text' as const, content: 'note' }
    ]
    expect(flattenActivityItems(items)).toEqual(items)
  })

  it('unwraps groups mixed with plain items, preserving order', () => {
    const group = {
      id: 'tool-group-t1-t2',
      type: 'tool-group' as const,
      toolName: 'run_terminal',
      count: 2,
      items: [toolItem('t1', 'run_terminal'), toolItem('t2', 'run_terminal')]
    }
    const items = [
      { id: 'r1', type: 'reasoning' as const, content: 'think' },
      group,
      toolItem('t3', 'write_file'),
      { id: 'x1', type: 'text' as const, content: 'done' }
    ]

    const flat = flattenActivityItems(items)
    expect(flat.map((item) => item.type)).toEqual(['reasoning', 'tool', 'tool', 'tool', 'text'])
    expect(flat.map((item) => item.id)).toEqual(['r1', 't1', 't2', 't3', 'x1'])
  })

  it('returns a plain list unchanged', () => {
    const items = [toolItem('t1', 'read_file'), toolItem('t2', 'read_file')]
    expect(flattenActivityItems(items)).toEqual(items)
  })
})
