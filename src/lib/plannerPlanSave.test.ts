import { afterEach, describe, expect, it, vi } from 'vitest'
import { savePlannerPlanFile } from './plannerPlanSave'

describe('plannerPlanSave', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves through the ipc bridge', async () => {
    const savePlannerPlan = vi.fn(async () => '.openrouter/plans/a.md')
    vi.stubGlobal('window', { api: { fs: { savePlannerPlan } } })
    await expect(savePlannerPlanFile('C:/ws', '# Камера')).resolves.toBe('.openrouter/plans/a.md')
    expect(savePlannerPlan).toHaveBeenCalledWith('# Камера', 'C:/ws')
  })

  it('throws when the bridge is missing', async () => {
    vi.stubGlobal('window', { api: { fs: {} } })
    await expect(savePlannerPlanFile('C:/ws', '# x')).rejects.toThrow(/savePlannerPlan/)
  })
})
