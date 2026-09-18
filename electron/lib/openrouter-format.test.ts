import { describe, expect, it } from 'vitest'
import { formatApiError } from '../services/openrouter'

describe('formatApiError', () => {
  it('includes provider metadata when present', () => {
    const message = formatApiError({
      error: {
        message: 'Provider error',
        metadata: { provider_name: 'Anthropic', raw: '{"message":"rate limited"}' }
      }
    })
    expect(message).toContain('Provider error')
    expect(message).toContain('Anthropic')
  })

  it('adds idle timeout hint', () => {
    const message = formatApiError({ message: 'Idle timeout exceeded' })
    expect(message).toContain('search_replace')
  })
})
