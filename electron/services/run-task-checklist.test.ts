import { describe, expect, it } from 'vitest'
import { RunTaskChecklist } from './run-task-checklist'

describe('RunTaskChecklist', () => {
  it('creates and updates checklist steps', () => {
    const checklist = new RunTaskChecklist()
    const created = checklist.create(['Read files', 'Apply edits', 'Run tests'])

    expect(created).toContain('[ ] 1. Read files')
    expect(created).toContain('[ ] 3. Run tests')

    const updated = checklist.update(2, 'done')
    expect(updated).toContain('[x] 2. Apply edits')
  })

  it('rejects invalid step numbers', () => {
    const checklist = new RunTaskChecklist()
    checklist.create(['Only step'])
    expect(() => checklist.update(2, 'done')).toThrow(/Invalid step number/)
  })
})
