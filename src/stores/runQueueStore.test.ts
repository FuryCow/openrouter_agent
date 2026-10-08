import { beforeEach, describe, expect, it } from 'vitest'
import { useRunQueueStore } from './runQueueStore'
import type { QueueSnapshot } from '@/types'

const snapshot = (overrides: Partial<QueueSnapshot> = {}): QueueSnapshot => ({
  tasks: [
    {
      id: 'qtask-1',
      title: 'Fix bug',
      prompt: 'Fix the bug',
      status: 'running',
      source: 'user',
      dependsOn: [],
      createdAt: '2026-10-08T10:00:00.000Z'
    }
  ],
  paused: false,
  maxConcurrent: 1,
  ...overrides
})

describe('runQueueStore', () => {
  beforeEach(() => {
    useRunQueueStore.getState().reset()
  })

  it('applies a snapshot', () => {
    useRunQueueStore.getState().applySnapshot(snapshot())
    const state = useRunQueueStore.getState()
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0].id).toBe('qtask-1')
    expect(state.paused).toBe(false)
    expect(state.maxConcurrent).toBe(1)
  })

  it('applies pause state and reason', () => {
    useRunQueueStore.getState().applySnapshot(snapshot({ paused: true, pausedReason: 'foreground' }))
    expect(useRunQueueStore.getState().paused).toBe(true)
    expect(useRunQueueStore.getState().pausedReason).toBe('foreground')
  })

  it('stores drained summary', () => {
    useRunQueueStore
      .getState()
      .applySnapshot(snapshot({ drainedSummary: { total: 3, completed: 2, error: 0, awaitingApproval: 1 } }))
    expect(useRunQueueStore.getState().drainedSummary).toEqual({
      total: 3,
      completed: 2,
      error: 0,
      awaitingApproval: 1
    })
  })

  it('reset clears everything', () => {
    useRunQueueStore.getState().applySnapshot(snapshot({ paused: true }))
    useRunQueueStore.getState().reset()
    expect(useRunQueueStore.getState().tasks).toEqual([])
    expect(useRunQueueStore.getState().paused).toBe(false)
    expect(useRunQueueStore.getState().drainedSummary).toBeUndefined()
  })
})
