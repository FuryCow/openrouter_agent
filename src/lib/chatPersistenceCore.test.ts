import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/types'
import { messagesForMode } from './chatPersistenceCore'

describe('messagesForMode', () => {
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'agent msg', mode: 'agent' },
    { id: '2', role: 'user', content: 'ask msg', mode: 'ask' },
    { id: '3', role: 'user', content: 'legacy msg' }
  ]

  it('returns only messages for the requested mode', () => {
    expect(messagesForMode(messages, 'agent').map((m) => m.id)).toEqual(['1', '3'])
    expect(messagesForMode(messages, 'ask').map((m) => m.id)).toEqual(['2'])
    expect(messagesForMode(messages, 'planner')).toEqual([])
  })
})
