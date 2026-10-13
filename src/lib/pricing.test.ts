import { describe, expect, it } from 'vitest'
import {
  buildPriceLabel,
  estimateRunCostUsd,
  estimateUsageCost,
  formatCostUsd,
  formatModelPricing,
  formatSessionCost,
  formatUsdPerMillion,
  usdPerMillionFromApiValue
} from './pricing'
import type { AgentRunAnalytics, ModelInfo } from '@/types'

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

describe('estimateUsageCost', () => {
  it('returns null when either price is missing', () => {
    expect(estimateUsageCost({ promptTokens: 10, completionTokens: 10 }, null, 15)).toBeNull()
    expect(estimateUsageCost({ promptTokens: 10, completionTokens: 10 }, 3, null)).toBeNull()
    expect(estimateUsageCost({ promptTokens: 10, completionTokens: 10 }, null, null)).toBeNull()
  })

  it('returns 0 for free models', () => {
    expect(estimateUsageCost({ promptTokens: 1000, completionTokens: 500 }, 0, 0)).toBe(0)
  })

  it('prices prompt and completion tokens per million', () => {
    expect(
      estimateUsageCost({ promptTokens: 2_000_000, completionTokens: 1_000_000 }, 3, 15)
    ).toBe(21)
    expect(estimateUsageCost({ promptTokens: 1, completionTokens: 1 }, 3, 15)).toBeCloseTo(
      0.000018,
      10
    )
  })
})

describe('formatCostUsd', () => {
  it('picks precision by magnitude', () => {
    expect(formatCostUsd(150)).toBe('$150')
    expect(formatCostUsd(1.5)).toBe('$1.50')
    expect(formatCostUsd(0.0123)).toBe('$0.012')
    expect(formatCostUsd(0.000009)).toBe('$0.000009')
  })
})

describe('formatSessionCost', () => {
  it('shows a dash when no cost is known', () => {
    expect(formatSessionCost(null)).toBe('—')
  })

  it('formats a known cost', () => {
    expect(formatSessionCost(0.0123)).toBe('$0.012')
  })
})

function model(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id: 'test/model',
    name: 'Test Model',
    inputModalities: ['text'],
    outputModalities: ['text'],
    supportsTools: true,
    supportsVision: false,
    promptPricePerM: 3,
    completionPricePerM: 15,
    priceLabel: '$3.00 in · $15.0 out / 1M',
    ...overrides
  }
}

function analytics(
  overrides: Partial<Pick<AgentRunAnalytics, 'model' | 'tokenUsage'>> = {}
): Pick<AgentRunAnalytics, 'model' | 'tokenUsage'> {
  return {
    model: 'test/model',
    tokenUsage: { promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000 },
    ...overrides
  }
}

describe('estimateRunCostUsd', () => {
  it('returns null when the model is not in the catalog', () => {
    expect(estimateRunCostUsd(analytics({ model: 'gone/model' }), [model()])).toBeNull()
    expect(estimateRunCostUsd(analytics(), [])).toBeNull()
  })

  it('returns null when the run has no token usage', () => {
    expect(estimateRunCostUsd(analytics({ tokenUsage: undefined }), [model()])).toBeNull()
    expect(
      estimateRunCostUsd(
        analytics({ tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }),
        [model()]
      )
    ).toBeNull()
  })

  it('prices the run with the model of that run', () => {
    expect(estimateRunCostUsd(analytics(), [model()])).toBe(18)
  })

  it('returns null for a catalog model without public prices', () => {
    expect(
      estimateRunCostUsd(analytics(), [model({ promptPricePerM: null, completionPricePerM: null })])
    ).toBeNull()
  })

  it('prefers the exact cost reported by OpenRouter over the estimate', () => {
    const run = analytics({
      tokenUsage: {
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        totalTokens: 2_000_000,
        costUsd: 0.1234
      }
    })
    expect(estimateRunCostUsd(run, [model()])).toBe(0.1234)
    expect(estimateRunCostUsd(run, [])).toBe(0.1234)
  })
})
