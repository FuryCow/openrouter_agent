import { describe, expect, it } from 'vitest'
import { getMessageRememberContent } from './messageRemember'

describe('getMessageRememberContent', () => {
  it('prefers message content', () => {
    expect(
      getMessageRememberContent({
        content: 'Final answer',
        timeline: [{ id: '1', type: 'text', content: 'Ignored' }]
      })
    ).toBe('Final answer')
  })

  it('falls back to timeline text blocks', () => {
    expect(
      getMessageRememberContent({
        content: '',
        timeline: [
          { id: '1', type: 'tool', toolCall: { id: 't1', name: 'read_file', arguments: '{}', status: 'done' } },
          { id: '2', type: 'text', content: 'Use batch read_files' }
        ]
      })
    ).toBe('Use batch read_files')
  })
})
