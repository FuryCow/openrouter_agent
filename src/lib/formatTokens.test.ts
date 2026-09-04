import { describe, expect, it } from 'vitest'
import { formatTokenCount, formatTokenPercent } from './formatTokens'

describe('formatTokens', () => {
  it('formats token counts', () => {
    expect(formatTokenCount(500)).toBe('500')
    expect(formatTokenCount(1500)).toBe('1.5K')
    expect(formatTokenCount(12000)).toBe('12K')
    expect(formatTokenCount(1_200_000)).toBe('1.2M')
  })

  it('formats percent capped at 100', () => {
    expect(formatTokenPercent(50, 100)).toBe(50)
    expect(formatTokenPercent(150, 100)).toBe(100)
    expect(formatTokenPercent(10, 0)).toBe(0)
  })
})
