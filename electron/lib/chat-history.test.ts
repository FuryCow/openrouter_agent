import { describe, expect, it } from 'vitest'
import {
  isEligibleAgentHistoryMessage,
  retainToolApiMessagesOnly,
  stripStaleInterruptedApiContext
} from './chat-history'
import type { ChatMessage } from '../types'

describe('isEligibleAgentHistoryMessage', () => {
  it('keeps interrupted runs that still have apiMessages', () => {
    const message: ChatMessage = {
      id: '1',
      role: 'assistant',
      content: '⚠️ Run aborted.',
      interrupted: true,
      isError: true,
      apiMessages: [
        { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
        { role: 'tool', content: 'ok', tool_call_id: 'c1', name: 'read_file' }
      ]
    }
    expect(isEligibleAgentHistoryMessage(message)).toBe(true)
  })

  it('retains only assistant and tool api messages', () => {
    const retained = retainToolApiMessagesOnly([
      { role: 'user', content: 'не загоняйся' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
      { role: 'tool', content: 'ok', tool_call_id: 'c1', name: 'read_file' }
    ])
    expect(retained).toHaveLength(2)
    expect(retained.every((message) => message.role !== 'user')).toBe(true)
  })

  it('strips api context from older interrupted runs', () => {
    const messages = [
      { id: '1', role: 'user', content: 'old task' },
      {
        id: '2',
        role: 'assistant',
        content: '',
        interrupted: true,
        apiMessages: [{ role: 'tool', content: 'done', tool_call_id: 'c1', name: 'read_file' }]
      },
      { id: '3', role: 'user', content: 'new task' }
    ] as ChatMessage[]

    const stripped = stripStaleInterruptedApiContext(messages)
    expect(stripped[1].apiMessages).toBeUndefined()
    expect(stripped[2].apiMessages).toBeUndefined()
  })

  it('drops hard errors without retained api context', () => {
    expect(
      isEligibleAgentHistoryMessage({
        id: '1',
        role: 'assistant',
        content: '⚠️ failed',
        isError: true
      })
    ).toBe(false)
  })
})
