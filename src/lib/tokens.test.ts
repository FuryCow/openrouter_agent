import { describe, expect, it } from 'vitest'
import { estimateTokens, trimToTokenBudget } from './tokens'

describe('tokens', () => {
  it('estimates tokens from char length', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('a'.repeat(8))).toBe(2)
  })

  it('trims text to token budget', () => {
    const text = 'a'.repeat(100)
    const trimmed = trimToTokenBudget(text, 5)
    expect(trimmed.length).toBeLessThan(text.length)
    expect(trimmed).toContain('truncated')
  })
})
