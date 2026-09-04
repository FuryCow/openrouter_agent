import { describe, expect, it } from 'vitest'
import { computeContextEstimate } from './useContextEstimate'
import type { ChatMessage } from '@/types'

describe('computeContextEstimate', () => {
  it('includes system overhead and messages for current mode', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'hello world', mode: 'agent' },
      { id: '2', role: 'assistant', content: 'response text', mode: 'agent' }
    ]

    const result = computeContextEstimate({
      messages,
      chatMode: 'agent',
      activeTimeline: [],
      isStreaming: false,
      customSystemPrompt: '',
      tabs: [],
      contextLimit: 100_000
    })

    expect(result.estimatedContext).toBeGreaterThan(1200)
    expect(result.contextPercent).toBeGreaterThan(0)
    expect(result.contextPercent).toBeLessThanOrEqual(100)
  })

  it('adds active timeline tokens while streaming', () => {
    const base = computeContextEstimate({
      messages: [],
      chatMode: 'agent',
      activeTimeline: [],
      isStreaming: false,
      customSystemPrompt: '',
      tabs: [],
      contextLimit: 100_000
    })

    const streaming = computeContextEstimate({
      messages: [],
      chatMode: 'agent',
      activeTimeline: [{ id: 't1', type: 'text', content: 'x'.repeat(400) }],
      isStreaming: true,
      customSystemPrompt: '',
      tabs: [],
      contextLimit: 100_000
    })

    expect(streaming.estimatedContext).toBeGreaterThan(base.estimatedContext)
  })

  it('ignores messages from other chat modes', () => {
    const withPlanner = computeContextEstimate({
      messages: [
        { id: '1', role: 'user', content: 'x'.repeat(400), mode: 'planner' },
        { id: '2', role: 'user', content: 'y'.repeat(400), mode: 'agent' }
      ],
      chatMode: 'agent',
      activeTimeline: [],
      isStreaming: false,
      customSystemPrompt: '',
      tabs: [],
      contextLimit: 100_000
    })

    const agentOnly = computeContextEstimate({
      messages: [{ id: '2', role: 'user', content: 'y'.repeat(400), mode: 'agent' }],
      chatMode: 'agent',
      activeTimeline: [],
      isStreaming: false,
      customSystemPrompt: '',
      tabs: [],
      contextLimit: 100_000
    })

    expect(withPlanner.estimatedContext).toBe(agentOnly.estimatedContext)
  })
})
