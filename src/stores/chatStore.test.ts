import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStore } from './chatStore'

describe('chatStore streaming', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useChatStore.setState({
      messages: [],
      isStreaming: false,
      activeTimeline: [],
      pendingApproval: null,
      pendingMemorySuggest: null
    })
    useChatStore.getState().clearStream()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes stream chunks on timer', () => {
    useChatStore.getState().appendStream('hello')
    expect(useChatStore.getState().activeTimeline).toHaveLength(0)
    vi.advanceTimersByTime(100)
    expect(useChatStore.getState().activeTimeline).toEqual([
      expect.objectContaining({ type: 'text', content: 'hello' })
    ])
  })

  it('caps reasoning text during flush', () => {
    const huge = 'x'.repeat(300_000)
    useChatStore.getState().appendReasoning(huge)
    useChatStore.getState().flushStreamBuffer()
    const reasoning = useChatStore.getState().activeTimeline.find((item) => item.type === 'reasoning')
    expect(reasoning?.content).toHaveLength(250_000)
  })

  it('clearStream resets timeline and pending buffer', () => {
    useChatStore.getState().appendStream('partial')
    useChatStore.getState().clearStream()
    vi.advanceTimersByTime(100)
    expect(useChatStore.getState().activeTimeline).toHaveLength(0)
  })

  it('buffers tool progress until flush', () => {
    useChatStore.getState().updateToolCall({
      id: 'tool-1',
      name: 'read_file',
      arguments: '{}',
      status: 'running'
    })
    vi.advanceTimersByTime(100)
    expect(useChatStore.getState().activeTimeline).toEqual([
      expect.objectContaining({ type: 'tool', toolCall: expect.objectContaining({ id: 'tool-1' }) })
    ])
  })

  it('keeps interleaved reasoning and text in one thinking block', () => {
    useChatStore.getState().appendReasoning('Принято — масштаб')
    useChatStore.getState().appendStream('ируем от леса')
    vi.advanceTimersByTime(100)
    expect(useChatStore.getState().activeTimeline).toEqual([
      expect.objectContaining({ type: 'reasoning', content: 'Принято — масштабируем от леса' })
    ])
  })

  it('starts a text item after a heading following thinking', () => {
    useChatStore.getState().appendReasoning('notes')
    useChatStore.getState().appendStream('# Goal\nShip it')
    vi.advanceTimersByTime(100)
    expect(useChatStore.getState().activeTimeline.map((item) => item.type)).toEqual([
      'reasoning',
      'text'
    ])
  })
})
