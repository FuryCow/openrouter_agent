import { describe, expect, it } from 'vitest'
import { isRetryableOpenRouterError, shouldEmitIterationWarning } from './agent-run-guards'

describe('agent-run-guards', () => {
  it('detects retryable OpenRouter errors', () => {
    expect(isRetryableOpenRouterError('Idle timeout while streaming')).toBe(true)
    expect(isRetryableOpenRouterError('Gateway 504')).toBe(true)
    expect(isRetryableOpenRouterError('401 Unauthorized')).toBe(false)
  })

  it('warns only for the last three iterations', () => {
    expect(shouldEmitIterationWarning(3)).toBe(true)
    expect(shouldEmitIterationWarning(0)).toBe(true)
    expect(shouldEmitIterationWarning(4)).toBe(false)
    expect(shouldEmitIterationWarning(-1)).toBe(false)
  })
})
