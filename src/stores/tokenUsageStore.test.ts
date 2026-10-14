import { beforeEach, describe, expect, it } from 'vitest'
import { useTokenUsageStore } from './tokenUsageStore'

const usage = (promptTokens: number, completionTokens: number) => ({
  promptTokens,
  completionTokens,
  totalTokens: promptTokens + completionTokens
})

describe('tokenUsageStore', () => {
  beforeEach(() => {
    useTokenUsageStore.getState().resetSession()
  })

  it('accumulates tokens and cost across runs', () => {
    const { addUsage } = useTokenUsageStore.getState()
    addUsage(usage(100, 50), 0.5)
    addUsage(usage(10, 5), 0.25)

    expect(useTokenUsageStore.getState().session).toEqual({
      promptTokens: 110,
      completionTokens: 55,
      totalTokens: 165,
      costUsd: 0.75
    })
  })

  it('ignores empty usage reports', () => {
    const { addUsage } = useTokenUsageStore.getState()
    addUsage(undefined, 1)
    addUsage(usage(0, 0), 1)

    expect(useTokenUsageStore.getState().session).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: null
    })
  })

  it('keeps the accumulated cost when a run has no known cost', () => {
    const { addUsage } = useTokenUsageStore.getState()
    addUsage(usage(100, 50), 0.5)
    addUsage(usage(10, 5), null)
    addUsage(usage(10, 5), undefined)

    expect(useTokenUsageStore.getState().session.costUsd).toBe(0.5)
  })

  it('starts the cost from zero on the first known price', () => {
    const { addUsage } = useTokenUsageStore.getState()
    addUsage(usage(100, 50), null)
    expect(useTokenUsageStore.getState().session.costUsd).toBeNull()

    addUsage(usage(10, 5), 0.3)
    expect(useTokenUsageStore.getState().session.costUsd).toBe(0.3)
  })

  it('resetSession clears tokens and cost', () => {
    const store = useTokenUsageStore.getState()
    store.addUsage(usage(100, 50), 0.5)
    store.resetSession()

    expect(useTokenUsageStore.getState().session).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: null
    })
  })
})
