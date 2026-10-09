import { describe, expect, it } from 'vitest'
import {
  estimateTokens,
  trimToTokenBudget,
  resolveContextBudget,
  resolveReadBudgetChars,
  DEFAULT_CONTEXT_BUDGET,
  FALLBACK_CONTEXT_LENGTH
} from './tokens'

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

  it('resolves the context budget from the model context length', () => {
    expect(resolveContextBudget(200_000)).toBe(120_000)
    expect(resolveContextBudget(undefined)).toBe(Math.floor(128_000 * 0.6))
    expect(resolveContextBudget(8_000)).toBe(16_000)
  })

  it('resolves read budgets from the model context length', () => {
    const fallback = resolveReadBudgetChars(undefined)
    expect(fallback.maxFiles).toBe(20)
    expect(fallback.perFile).toBe(Math.max(50_000, Math.floor(128_000 * 4 * 0.4 / 3)))
    expect(fallback.total).toBe(Math.max(150_000, 128_000 * 4 * 0.4))

    const big = resolveReadBudgetChars(1_000_000)
    expect(big.perFile).toBe(Math.floor(1_000_000 * 4 * 0.4 / 3))
    expect(big.total).toBe(1_000_000 * 4 * 0.4)

    const small = resolveReadBudgetChars(16_000)
    expect(small.perFile).toBe(50_000)
    expect(small.total).toBe(150_000)
  })

  it('keeps the documented fallback constants', () => {
    expect(DEFAULT_CONTEXT_BUDGET).toBe(80_000)
    expect(FALLBACK_CONTEXT_LENGTH).toBe(128_000)
  })
})
