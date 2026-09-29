import { describe, expect, it } from 'vitest'
import {
  attachProviderPolicies,
  modelIconUrl,
  normalizeModelEndpoints,
  normalizeProviderCatalog,
  providerSlugFromTag,
  sortModels
} from './models'
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

describe('normalizeModelEndpoints', () => {
  it('keeps the full tag, skips rows without one, and sorts by input price', () => {
    const endpoints = normalizeModelEndpoints({
      data: {
        endpoints: [
          {
            provider_name: 'Sail Research',
            tag: 'sail',
            pricing: { prompt: '0.000000045', completion: '0.0000006' }
          },
          {
            provider_name: 'Vertex',
            tag: 'google-vertex/us-east5',
            pricing: { prompt: '0.00000002', completion: '0.0000003' }
          },
          { provider_name: 'Untagged', pricing: { prompt: '0', completion: '0' } }
        ]
      }
    })

    expect(endpoints.map((endpoint) => endpoint.tag)).toEqual(['google-vertex/us-east5', 'sail'])
    expect(endpoints[0]?.name).toBe('Vertex')
    expect(endpoints[0]?.priceLabel).toBe('$0.0200 in · $0.300 out / 1M')
  })

  it('reads a bare endpoints list', () => {
    const endpoints = normalizeModelEndpoints({
      endpoints: [{ provider_name: 'Relace', tag: 'relace', pricing: { prompt: '0', completion: '0' } }]
    })
    expect(endpoints).toEqual([
      {
        tag: 'relace',
        name: 'Relace',
        promptPricePerM: 0,
        completionPricePerM: 0,
        priceLabel: 'Free in · Free out / 1M'
      }
    ])
  })
})

describe('provider policies', () => {
  it('reads the base slug and attaches the cached catalog entry', () => {
    expect(providerSlugFromTag('google-vertex/us-east5')).toBe('google-vertex')
    const catalog = normalizeProviderCatalog({
      data: [
        {
          slug: 'Open-Inference',
          icon: { url: 'https://example.test/icon.png' },
          dataPolicy: { retainsPrompts: true, training: false, retentionDays: 30 }
        }
      ]
    })
    const [endpoint] = attachProviderPolicies(
      [
        {
          tag: 'open-inference/fp4',
          name: 'OpenInference',
          promptPricePerM: 0.02,
          completionPricePerM: 0.3,
          priceLabel: ''
        }
      ],
      catalog
    )
    expect(endpoint?.iconUrl).toBe('https://example.test/icon.png')
    expect(endpoint?.retainsPrompts).toBe(true)
    expect(endpoint?.trainsOnData).toBe(false)
    expect(endpoint?.retentionDays).toBe(30)
  })

  it('uses the author slug icon and a known filename when the catalog has none', () => {
    const catalog = normalizeProviderCatalog({
      data: [{ slug: 'z-ai', icon: { url: '/images/icons/ZAI.svg' }, dataPolicy: {} }]
    })
    expect(modelIconUrl('z-ai/glm-5.3-flash', catalog)).toBe('https://openrouter.ai/images/icons/ZAI.svg')
    expect(modelIconUrl('google/gemini-3', catalog)).toBe(
      'https://openrouter.ai/images/icons/GoogleGemini.svg'
    )
  })
})
