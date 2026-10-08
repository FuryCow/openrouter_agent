import { create } from 'zustand'
import type { QueueSnapshot, QueuedRun } from '@/types'

interface RunQueueState {
  tasks: QueuedRun[]
  paused: boolean
  pausedReason?: QueueSnapshot['pausedReason']
  drainedSummary?: QueueSnapshot['drainedSummary']
  maxConcurrent: number
  applySnapshot: (snapshot: QueueSnapshot) => void
  reset: () => void
}

export const useRunQueueStore = create<RunQueueState>((set) => ({
  tasks: [],
  paused: false,
  pausedReason: undefined,
  drainedSummary: undefined,
  maxConcurrent: 1,
  applySnapshot: (snapshot) =>
    set({
      tasks: snapshot.tasks ?? [],
      paused: snapshot.paused === true,
      pausedReason: snapshot.pausedReason,
      drainedSummary: snapshot.drainedSummary,
      maxConcurrent: snapshot.maxConcurrent ?? 1
    }),
  reset: () =>
    set({
      tasks: [],
      paused: false,
      pausedReason: undefined,
      drainedSummary: undefined,
      maxConcurrent: 1
    })
}))
