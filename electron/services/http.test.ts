import { describe, expect, it } from 'vitest'
import { formatNetworkError } from './http'

describe('formatNetworkError', () => {
  it('formats fetch failed with cause code', () => {
    const error = new Error('fetch failed', { cause: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' } })
    expect(formatNetworkError(error).message).toContain('ENOTFOUND')
  })

  it('falls back to string for unknown values', () => {
    expect(formatNetworkError('offline').message).toBe('offline')
  })
})
