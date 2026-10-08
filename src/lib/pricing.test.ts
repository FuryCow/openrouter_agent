import { describe, expect, it } from 'vitest'
import {
  buildPriceLabel,
  formatModelPricing,
  formatUsdPerMillion,
  usdPerMillionFromApiValue
} from './pricing'

describe('usdPerMillionFromApiValue', () => {
  it('converts per-token prices to per-million', () => {
    expect(usdPerMillionFromApiValue(0.000003)).toBe(3)
    expect(usdPerMillionFromApiValue('0.000015')).toBe(15)
  })

  it('returns null for missing or invalid values', () => {
    expect(usdPerMillionFromApiValue(undefined)).toBeNull()
    expect(usdPerMillionFromApiValue(null)).toBeNull()
    expect(usdPerMillionFromApiValue('')).toBeNull()
    expect(usdPerMillionFromApiValue('not-a-number')).toBeNull()
  })

  it('keeps zero as zero (free models)', () => {
    expect(usdPerMillionFromApiValue(0)).toBe(0)
    expect(usdPerMillionFromApiValue('0')).toBe(0)
  })
})

describe('formatUsdPerMillion', () => {
  it('formats free models', () => {
    expect(formatUsdPerMillion(0)).toBe('Free')
  })

  it('shows a dash for missing prices', () => {
    expect(formatUsdPerMillion(null)).toBe('—')
  })

  it('picks precision by magnitude', () => {
    expect(formatUsdPerMillion(150)).toBe('$150')
    expect(formatUsdPerMillion(12.34)).toBe('$12.3')
    expect(formatUsdPerMillion(3.5)).toBe('$3.50')
    expect(formatUsdPerMillion(0.25)).toBe('$0.250')
    expect(formatUsdPerMillion(0.015)).toBe('$0.0150')
    expect(formatUsdPerMillion(0.000123)).toBe('$0.000123')
  })
})

describe('buildPriceLabel', () => {
  it('combines input and output into one label', () => {
    expect(buildPriceLabel(3, 15)).toBe('$3.00 in · $15.0 out / 1M')
  })

  it('handles free and missing prices', () => {
    expect(buildPriceLabel(0, null)).toBe('Free in · — out / 1M')
  })
})

describe('formatModelPricing', () => {
  it('returns input, output, and combined strings', () => {
    expect(formatModelPricing(3, 15)).toEqual({
      input: '$3.00',
      output: '$15.0',
      combined: '$3.00 in · $15.0 out / 1M'
    })
  })

  it('treats undefined prices as missing', () => {
    expect(formatModelPricing(undefined, undefined).combined).toBe('— in · — out / 1M')
  })
})
