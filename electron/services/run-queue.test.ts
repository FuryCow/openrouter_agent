import { describe, expect, it } from 'vitest'
import {
  hydrateQueueState,
  pickNextTasks,
  resolveDependents,
  serializeQueueState,
  validateEnqueueInput
} from './run-queue'
import type { QueueEnqueueInput, QueuedRun } from '../types'

function task(overrides: Partial<QueuedRun> & { id: string }): QueuedRun {
  return {
    title: 'Task',
    prompt: 'Do it',
    status: 'queued',
    source: 'user',
    dependsOn: [],
    createdAt: '2026-10-08T10:00:00.000Z',
    ...overrides
  }
}

describe('pickNextTasks', () => {
  it('returns queued tasks with all deps completed, FIFO by createdAt', () => {
    const tasks = [
      task({ id: 'a', createdAt: '2026-10-08T10:00:02.000Z' }),
      task({ id: 'b', createdAt: '2026-10-08T10:00:01.000Z' }),
      task({ id: 'c', status: 'completed' }),
      task({ id: 'd', status: 'cancelled' })
    ]
    expect(pickNextTasks(tasks, 1, false).map((t) => t.id)).toEqual(['b'])
  })

  it('respects maxConcurrent with active runs', () => {
    const tasks = [
      task({ id: 'a', status: 'running' }),
      task({ id: 'b' }),
      task({ id: 'c' })
    ]
    expect(pickNextTasks(tasks, 1, false)).toEqual([])
    expect(pickNextTasks(tasks, 2, false).map((t) => t.id)).toEqual(['b'])
  })

  it('returns nothing while paused', () => {
    const tasks = [task({ id: 'a' })]
    expect(pickNextTasks(tasks, 1, true)).toEqual([])
  })

  it('waits for dependencies that are not completed', () => {
    const tasks = [
      task({ id: 'dep', status: 'running' }),
      task({ id: 'child', dependsOn: ['dep'] })
    ]
    expect(pickNextTasks(tasks, 1, false)).toEqual([])
  })

  it('starts a dependent after its dep completes', () => {
    const tasks = [
      task({ id: 'dep', status: 'completed' }),
      task({ id: 'child', dependsOn: ['dep'] })
    ]
    expect(pickNextTasks(tasks, 1, false).map((t) => t.id)).toEqual(['child'])
  })

  it('never starts a dependent whose dep failed', () => {
    const tasks = [
      task({ id: 'dep', status: 'error' }),
      task({ id: 'child', dependsOn: ['dep'] })
    ]
    expect(pickNextTasks(tasks, 1, false)).toEqual([])
  })
})

describe('resolveDependents', () => {
  it('cancels queued dependents when the dep did not complete', () => {
    const tasks = [
      task({ id: 'dep', status: 'error' }),
      task({ id: 'child', dependsOn: ['dep'] }),
      task({ id: 'other', dependsOn: ['unrelated'] })
    ]
    const result = resolveDependents(tasks, 'dep', 'error')
    expect(result).toEqual([
      { id: 'child', status: 'cancelled', error: 'Dependency dep did not complete' }
    ])
  })

  it('does nothing when the dep completed', () => {
    const tasks = [task({ id: 'child', dependsOn: ['dep'] })]
    expect(resolveDependents(tasks, 'dep', 'completed')).toEqual([])
  })

  it('ignores dependents that are not queued anymore', () => {
    const tasks = [task({ id: 'child', dependsOn: ['dep'], status: 'cancelled' })]
    expect(resolveDependents(tasks, 'dep', 'error')).toEqual([])
  })
})

describe('validateEnqueueInput', () => {
  const base: QueueEnqueueInput = { title: 'Fix bug', prompt: 'Fix the bug in src/app.ts', source: 'user' }

  it('accepts a valid input', () => {
    expect(() => validateEnqueueInput(base, [])).not.toThrow()
  })

  it('rejects empty title/prompt', () => {
    expect(() => validateEnqueueInput({ ...base, title: '   ' }, [])).toThrow()
    expect(() => validateEnqueueInput({ ...base, prompt: '' }, [])).toThrow()
  })

  it('rejects overlong title/prompt', () => {
    expect(() => validateEnqueueInput({ ...base, title: 'x'.repeat(121) }, [])).toThrow()
    expect(() => validateEnqueueInput({ ...base, prompt: 'x'.repeat(8001) }, [])).toThrow()
  })

  it('rejects more than 20 pending tasks', () => {
    const tasks = Array.from({ length: 20 }, (_, i) => task({ id: `t${i}` }))
    expect(() => validateEnqueueInput(base, tasks)).toThrow()
  })

  it('counts only queued/awaiting tasks toward the cap', () => {
    const tasks = [
      ...Array.from({ length: 20 }, (_, i) => task({ id: `t${i}`, status: 'completed' as const })),
      task({ id: 'active', status: 'running' })
    ]
    expect(() => validateEnqueueInput(base, tasks)).not.toThrow()
  })

  it('rejects unknown dependencies', () => {
    expect(() => validateEnqueueInput({ ...base, dependsOn: ['ghost'] }, [])).toThrow()
  })

  it('accepts depending on an existing task (chain, edges point to older tasks)', () => {
    const tasks = [task({ id: 'a' })]
    expect(() => validateEnqueueInput({ ...base, dependsOn: ['a'] }, tasks)).not.toThrow()
  })

  it('rejects a cycle in corrupt existing state (defense-in-depth DFS)', () => {
    const tasks = [
      task({ id: 'a', dependsOn: ['b'] }),
      task({ id: 'b', dependsOn: ['a'] })
    ]
    expect(() => validateEnqueueInput({ ...base, dependsOn: ['a'] }, tasks)).toThrow()
  })

  it('accepts a valid chain', () => {
    const tasks = [task({ id: 'a' })]
    expect(() => validateEnqueueInput({ ...base, dependsOn: ['a'] }, tasks)).not.toThrow()
  })
})

describe('serializeQueueState / hydrateQueueState', () => {
  it('round-trips tasks and drops volatile fields', () => {
    const tasks = [
      task({
        id: 'a',
        status: 'completed',
        tail: 'stream tail',
        checklist: [{ text: 'step', status: 'done' }],
        approval: { id: 'ap', toolCallId: 'tc', name: 'write_file', arguments: '{}' }
      })
    ]
    const raw = serializeQueueState(tasks, false)
    const parsed = JSON.parse(raw) as { tasks: Array<Record<string, unknown>> }
    expect(parsed.tasks[0].tail).toBeUndefined()
    expect(parsed.tasks[0].checklist).toBeUndefined()
    expect(parsed.tasks[0].approval).toBeUndefined()

    const hydrated = hydrateQueueState(raw)
    expect(hydrated.tasks).toHaveLength(1)
    expect(hydrated.tasks[0].id).toBe('a')
    expect(hydrated.tasks[0].status).toBe('completed')
    expect(hydrated.tasks[0].tail).toBeUndefined()
  })

  it('marks unfinished tasks as interrupted on load', () => {
    const raw = serializeQueueState(
      [task({ id: 'a', status: 'running' }), task({ id: 'b', status: 'completed' })],
      false
    )
    const hydrated = hydrateQueueState(raw, () => '2026-10-08T12:00:00.000Z')
    expect(hydrated.tasks[0].status).toBe('interrupted')
    expect(hydrated.tasks[0].error).toContain('closed')
    expect(hydrated.tasks[1].status).toBe('completed')
  })

  it('drops deps pointing to unknown tasks', () => {
    const raw = serializeQueueState([task({ id: 'a', dependsOn: ['ghost'] })], false)
    const hydrated = hydrateQueueState(raw)
    expect(hydrated.tasks[0].dependsOn).toEqual([])
  })

  it('returns empty state for corrupt or missing files', () => {
    expect(hydrateQueueState(null)).toEqual({ tasks: [], paused: false })
    expect(hydrateQueueState('not json')).toEqual({ tasks: [], paused: false })
    expect(hydrateQueueState('{"version":1}')).toEqual({ tasks: [], paused: false })
  })

  it('restores the paused flag', () => {
    const raw = serializeQueueState([], true)
    expect(hydrateQueueState(raw).paused).toBe(true)
  })
})
