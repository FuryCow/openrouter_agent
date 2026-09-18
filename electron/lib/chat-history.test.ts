import { describe, expect, it } from 'vitest'
import { isEligibleAgentHistoryMessage } from './chat-history'
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
