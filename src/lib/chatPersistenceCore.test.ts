import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/types'
import { latestChatMode, messagesForMode, resolvePersistenceWorkspace } from './chatPersistenceCore'

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

describe('latestChatMode', () => {
  it('picks the mode of the newest message by id timestamp', () => {
    const messages: ChatMessage[] = [
      { id: 'user-100', role: 'user', content: 'a', mode: 'agent' },
      { id: 'assistant-200', role: 'assistant', content: 'plan', mode: 'planner' },
      { id: 'user-150', role: 'user', content: 'ask', mode: 'ask' }
    ]
    expect(latestChatMode(messages)).toBe('planner')
  })
})

describe('resolvePersistenceWorkspace', () => {
  it('matches workspace hydration rules', () => {
    expect(resolvePersistenceWorkspace(false, null, '/tmp')).toBeUndefined()
    expect(resolvePersistenceWorkspace(true, null, '/tmp')).toBeUndefined()
    expect(resolvePersistenceWorkspace(true, '/tmp/a', '/tmp/b')).toBe('/tmp/a')
  })
})
