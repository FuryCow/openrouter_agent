import { describe, expect, it } from 'vitest'
import { classifyToolErrorMessage, formatToolErrorFromMessage } from './tool-errors'

describe('tool-errors', () => {
  it('adds read_files hint for search_replace not found', () => {
    const formatted = formatToolErrorFromMessage('Error: old_string not found in file')
    expect(formatted).toContain('[not_found]')
    expect(formatted).toContain('read_files')
  })

  it('marks user rejection as non-retryable', () => {
    const err = classifyToolErrorMessage('User rejected this action.')
    expect(err.retryable).toBe(false)
    expect(err.kind).toBe('permission')
  })
})
