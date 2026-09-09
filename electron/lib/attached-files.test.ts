import { describe, expect, it } from 'vitest'
import { buildUserMessageWithAttachments } from './attached-files'

describe('buildUserMessageWithAttachments', () => {
  it('wraps attachment content with explicit instructions', () => {
    const message = buildUserMessageWithAttachments('summarize this', [
      { name: 'README.md', content: '# Hello' }
    ])

    expect(message).toContain('<attached_file name="README.md">')
    expect(message).toContain('# Hello')
    expect(message).toContain('answer from the `<attached_file>` blocks')
    expect(message).toContain('summarize this')
  })

  it('works when the user message is empty', () => {
    const message = buildUserMessageWithAttachments('', [
      { name: 'notes.txt', content: 'alpha' }
    ])

    expect(message).toContain('notes.txt')
    expect(message).toContain('alpha')
    expect(message).not.toMatch(/\n\n$/)
  })
})
