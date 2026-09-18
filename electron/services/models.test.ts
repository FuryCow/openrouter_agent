import { describe, expect, it } from 'vitest'
import { sortModels } from './models'
import type { ModelInfo } from '../types'

const sample = (id: string, promptPricePerM: number | null, agenticIndex?: number | null): ModelInfo => ({
  id,
  name: id,
  supportsTools: true,
  supportsVision: false,
  promptPricePerM,
  completionPricePerM: null,
  priceLabel: '',
  agenticIndex: agenticIndex ?? null
})

describe('sortModels', () => {
  it('sorts by price low to high', () => {
    const sorted = sortModels([sample('b', 2), sample('a', 1)], 'price-low')
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('sorts by agentic index descending', () => {
    const sorted = sortModels([sample('a', 1, 10), sample('b', 1, 50)], 'agentic')
    expect(sorted[0].id).toBe('b')
  })
})
