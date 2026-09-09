import { create } from 'zustand'

interface AgentContextState {
  pinnedPaths: string[]
  excludedPaths: string[]
  pinPath: (path: string) => void
  unpinPath: (path: string) => void
  excludePath: (path: string) => void
  includePath: (path: string) => void
  clearExcluded: () => void
}

export const useAgentContextStore = create<AgentContextState>((set) => ({
  pinnedPaths: [],
  excludedPaths: [],

  pinPath: (path) =>
    set((s) => ({
      pinnedPaths: s.pinnedPaths.includes(path) ? s.pinnedPaths : [...s.pinnedPaths, path],
      excludedPaths: s.excludedPaths.filter((p) => p !== path)
    })),

  unpinPath: (path) =>
    set((s) => ({
      pinnedPaths: s.pinnedPaths.filter((p) => p !== path)
    })),

  excludePath: (path) =>
    set((s) => ({
      excludedPaths: s.excludedPaths.includes(path) ? s.excludedPaths : [...s.excludedPaths, path]
    })),

  includePath: (path) =>
    set((s) => ({
      excludedPaths: s.excludedPaths.filter((p) => p !== path)
    })),

  clearExcluded: () => set({ excludedPaths: [] })
}))
