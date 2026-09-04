import { describe, expect, it } from 'vitest'
import { expandHistoryForApi, filterHistoryForApi } from '../services/agent-modes'
import type { ChatMessage } from '../types'

describe('agent-modes history', () => {
  it('filters error messages from history', () => {
    const history: ChatMessage[] = [
      { id: '1', role: 'user', content: 'hi' },
      { id: '2', role: 'assistant', content: '⚠️ failed', isError: true }
    ]
    expect(filterHistoryForApi(history, 'agent')).toHaveLength(1)
  })

  it('expands apiMessages when present', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'done',
        apiMessages: [
          { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
          { role: 'tool', content: 'file contents', tool_call_id: 'c1', name: 'read_file' }
        ]
      }
    ]
    const expanded = expandHistoryForApi(history, 'agent')
    expect(expanded).toHaveLength(2)
    expect(expanded[1].role).toBe('tool')
  })
})
