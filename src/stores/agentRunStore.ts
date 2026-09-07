import { create } from 'zustand'
import type { AgentRunStatus, RunCheckpointSummary } from '@/types'

interface AgentRunState {
  runStatus: AgentRunStatus | null
  checkpoint: RunCheckpointSummary | null
  setRunStatus: (status: AgentRunStatus | null) => void
  setCheckpoint: (checkpoint: RunCheckpointSummary | null) => void
  clearCheckpoint: () => void
}

export const useAgentRunStore = create<AgentRunState>((set) => ({
  runStatus: null,
  checkpoint: null,
  setRunStatus: (runStatus) => set({ runStatus }),
  setCheckpoint: (checkpoint) => set({ checkpoint }),
  clearCheckpoint: () => set({ checkpoint: null })
}))
