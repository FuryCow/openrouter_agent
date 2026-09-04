import { create } from 'zustand'
import type { AgentRunAnalytics } from '../types'

interface AnalyticsState {
  runs: AgentRunAnalytics[]
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  addRun: (run: AgentRunAnalytics) => void
  loadRuns: () => Promise<void>
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  runs: [],
  panelOpen: false,
  setPanelOpen: (open) => set({ panelOpen: open }),
  addRun: (run) =>
    set((state) => ({
      runs: [run, ...state.runs.filter((r) => r.runId !== run.runId)].slice(0, 50)
    })),
  loadRuns: async () => {
    const runs = await window.api.analytics.getRuns(30)
    set({ runs })
  }
}))
