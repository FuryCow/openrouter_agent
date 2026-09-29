import { describe, expect, it } from 'vitest'
import { toOpenRouterProviderBody } from './openrouter'

describe('toOpenRouterProviderBody', () => {
  it('leaves Auto on the default load balancer', () => {
    expect(toOpenRouterProviderBody()).toEqual({ provider: { allow_fallbacks: true } })
    expect(toOpenRouterProviderBody('  ')).toEqual({ provider: { allow_fallbacks: true } })
  })

  it('pins the full endpoint slug and disables fallbacks', () => {
    expect(toOpenRouterProviderBody('google-vertex/us-east5')).toEqual({
      provider: { only: ['google-vertex/us-east5'], allow_fallbacks: false }
    })
  })
})
