import { describe, expect, it, vi } from 'vitest'
import { applyHydratedSettings } from './settingsHydration'

describe('applyHydratedSettings', () => {
  it('sets working directory before returning settings', () => {
    const order: string[] = []
    const settings = {
      apiKey: 'key',
      model: 'anthropic/claude-sonnet-4',
      workingDirectory: '/tmp/project',
      locale: 'en'
    }

    const result = applyHydratedSettings(settings, (path) => {
      order.push('workingDirectory')
      expect(path).toBe('/tmp/project')
    })

    order.push('returned')
    expect(order).toEqual(['workingDirectory', 'returned'])
    expect(result).toBe(settings)
  })

  it('normalizes empty workspace to null', () => {
    const setWorkingDirectory = vi.fn()
    applyHydratedSettings(
      { apiKey: '', model: 'm', workingDirectory: '', locale: 'en' },
      setWorkingDirectory
    )
    expect(setWorkingDirectory).toHaveBeenCalledWith(null)
  })
})
