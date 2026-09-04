import { create } from 'zustand'
import type { IndexProgress, IndexStatus } from '@/types'

interface IndexState {
  status: IndexStatus
  setStatus: (status: IndexStatus) => void
  refreshStatus: () => Promise<void>
  rebuild: () => Promise<void>
  subscribe: () => () => void
}

const defaultStatus: IndexStatus = {
  state: 'idle',
  workspacePath: null,
  filesIndexed: 0,
  chunks: 0,
  symbols: 0,
  lastBuiltAt: null,
  progress: null,
  error: null,
  semanticReady: false,
  symbolReady: false
}

export const useIndexStore = create<IndexState>((set) => ({
  status: defaultStatus,
  setStatus: (status) => set({ status }),
  refreshStatus: async () => {
    const status = await window.api.index.getStatus()
    set({ status })
  },
  rebuild: async () => {
    const status = await window.api.index.rebuild()
    set({ status })
  },
  subscribe: () => {
    const onProgress = (_progress: IndexProgress): void => {
      void window.api.index.getStatus().then((status) => set({ status }))
    }
    const onStatus = (status: IndexStatus): void => set({ status })
    const unsubProgress = window.api.index.onProgress(onProgress)
    const unsubStatus = window.api.index.onStatus(onStatus)
    void window.api.index.getStatus().then((status) => set({ status }))
    return () => {
      unsubProgress()
      unsubStatus()
    }
  }
}))
