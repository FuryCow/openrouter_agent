import { create } from 'zustand'
import type { AgentRunStatus, RunCheckpointSummary, TaskChecklistStepState } from '@/types'

interface AgentRunState {
  runStatus: AgentRunStatus | null
  checkpoint: RunCheckpointSummary | null
  checklist: TaskChecklistStepState[] | null
  lastTerminalOutput: string | null
  changesPanelDismissed: boolean
  setRunStatus: (status: AgentRunStatus | null) => void
  setCheckpoint: (checkpoint: RunCheckpointSummary | null) => void
  clearCheckpoint: () => void
  setChecklist: (steps: TaskChecklistStepState[] | null) => void
  setLastTerminalOutput: (output: string | null) => void
  dismissChangesPanel: () => void
  showChangesPanel: () => void
  resetRunUi: () => void
}

export const useAgentRunStore = create<AgentRunState>((set) => ({
  runStatus: null,
  checkpoint: null,
  checklist: null,
  lastTerminalOutput: null,
  changesPanelDismissed: false,

  setRunStatus: (runStatus) => set({ runStatus }),
  setCheckpoint: (checkpoint) => set({ checkpoint }),
  clearCheckpoint: () => set({ checkpoint: null, changesPanelDismissed: false }),
  setChecklist: (checklist) => set({ checklist }),
  setLastTerminalOutput: (lastTerminalOutput) => set({ lastTerminalOutput }),
  dismissChangesPanel: () => set({ changesPanelDismissed: true }),
  showChangesPanel: () => set({ changesPanelDismissed: false }),
  resetRunUi: () =>
    set({
      runStatus: null,
      checklist: null,
      lastTerminalOutput: null
    })
}))
