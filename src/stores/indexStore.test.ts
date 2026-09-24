import { afterEach, describe, expect, it, vi } from 'vitest'
import { useIndexStore } from './indexStore'

describe('indexStore rebuild', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('records an error instead of staying on building', async () => {
    vi.stubGlobal('window', {
      api: {
        index: {
          rebuild: vi.fn(async () => {
            throw new Error('No workspace open for indexing')
          })
        }
      }
    })

    await useIndexStore.getState().rebuild()
    const status = useIndexStore.getState().status
    expect(status.state).toBe('error')
    expect(status.error).toBe('No workspace open for indexing')
  })
})
