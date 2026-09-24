import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir, platform } from 'os'
import {
  isPlannerPlanPath,
  looksLikePlannerPlanPath,
  planFileSlug,
  uniquePlanFilename,
  writePlannerPlan
} from './planner-plans'

describe('planner-plans', () => {
  it('accepts markdown under .openrouter/plans and rejects everything else', () => {
    const root = join(tmpdir(), 'proj')
    expect(looksLikePlannerPlanPath('.openrouter/plans/camera.md')).toBe(true)
    expect(isPlannerPlanPath(root, join(root, '.openrouter', 'plans', 'camera.md'))).toBe(true)
    expect(isPlannerPlanPath(root, join(root, 'src', 'foo.ts'))).toBe(false)
    expect(looksLikePlannerPlanPath('.openrouter/notes.md')).toBe(false)
    expect(looksLikePlannerPlanPath('.openrouter/plans/../secret.md')).toBe(false)
  })

  it('rejects a plan path on another drive', () => {
    if (platform() !== 'win32') return
    expect(isPlannerPlanPath('C:\\ws', 'D:\\other\\.openrouter\\plans\\x.md')).toBe(false)
  })

  it('builds a slug and unique filenames', () => {
    expect(planFileSlug('# Camera occlusion\n\nDo the thing')).toBe('camera-occlusion')
    expect(planFileSlug('# Камера\n\nСделать')).toBe('камера')
    expect(uniquePlanFilename('plan.md', ['plan.md'])).toBe('plan-2.md')
    expect(uniquePlanFilename('plan.md', ['plan.md', 'plan-2.md'])).toBe('plan-3.md')
  })

  it('writes a unique plan file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ora-plans-'))
    mkdirSync(join(dir, '.openrouter', 'plans'), { recursive: true })
    writeFileSync(join(dir, '.openrouter', 'plans', 'keep.md'), 'old', 'utf-8')
    const relative = await writePlannerPlan(dir, '# Camera occlusion\n\nSphereCast.')
    expect(relative.startsWith('.openrouter/plans/')).toBe(true)
    expect(relative.endsWith('.md')).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })
})
