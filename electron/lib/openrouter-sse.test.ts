import { describe, expect, it } from 'vitest'
import {
  extractReasoningFromDelta,
  mergeToolCallDelta,
  parseSseDataLine,
  splitSseBuffer,
  type SseStreamChunk
} from './openrouter-sse'
import type { ToolCall } from '../services/openrouter'

describe('openrouter-sse', () => {
  it('splitSseBuffer keeps partial line in remainder', () => {
    const { lines, remainder } = splitSseBuffer('data: {"a":1}\ndata: {"b":2')
    expect(lines).toEqual(['data: {"a":1}'])
    expect(remainder).toBe('data: {"b":2')
  })

  it('parseSseDataLine skips DONE and non-data lines', () => {
    expect(parseSseDataLine('data: [DONE]')).toBeNull()
    expect(parseSseDataLine(': ping')).toBeNull()
    expect(parseSseDataLine('data: {"ok":true}')).toBe('{"ok":true}')
  })

  it('extractReasoningFromDelta prefers reasoning_details', () => {
    expect(
      extractReasoningFromDelta({
        reasoning: 'ignored',
        reasoning_details: [{ text: 'step one' }, { summary: 'step two' }]
      })
    ).toBe('step onestep two')
  })

  it('mergeToolCallDelta accumulates tool call arguments', () => {
    const map = new Map<number, ToolCall>()
    mergeToolCallDelta(map, [
      { index: 0, id: 'call_1', function: { name: 'read_file', arguments: '{"path":' } }
    ])
    mergeToolCallDelta(map, [{ index: 0, function: { arguments: '"/tmp/a"}' } }])
    expect(map.get(0)?.function.arguments).toBe('{"path":"/tmp/a"}')
  })

  it('treats a literal "null" content delta as noise, not as answer text', () => {
    // Mirrors the streamCompletion filter: providers emit content:"null"
    // around tool calls; it must not reach the answer or the timeline.
    const chunks: SseStreamChunk[] = [
      { choices: [{ finish_reason: null, delta: { content: 'null' } }] },
      { choices: [{ finish_reason: null, delta: { content: '  null  ' } }] },
      { choices: [{ finish_reason: null, delta: { content: 'nullish' } }] },
      { choices: [{ finish_reason: null, delta: { content: 'real text' } }] }
    ]

    let content = ''
    for (const parsed of chunks) {
      const delta = parsed.choices?.[0]?.delta
      if (!delta) continue
      if (delta.content && delta.content.trim() !== 'null') {
        content += delta.content
      }
    }

    expect(content).toBe('nullishreal text')
  })
})
