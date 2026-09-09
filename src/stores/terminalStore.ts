import { create } from 'zustand'
import { titleFromFirstCommand } from '@/lib/terminalTabTitle'

export interface TerminalTab {
  id: string
  title: string
  cwd: string | null
  customTitle: boolean
}

function buildTab(cwd: string | null): TerminalTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'Terminal',
    cwd,
    customTitle: false
  }
}

export type CloseTerminalTabResult = 'closed' | 'hide-panel'

interface TerminalState {
  tabs: TerminalTab[]
  activeTabId: string | null
  ensureInitialTab: (cwd: string | null) => void
  addTab: (cwd: string | null) => void
  closeTab: (id: string) => CloseTerminalTabResult
  setActiveTab: (id: string) => void
  renameFromFirstCommand: (id: string, command: string) => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  ensureInitialTab: (cwd) => {
    if (get().tabs.length > 0) return
    const tab = buildTab(cwd)
    set({ tabs: [tab], activeTabId: tab.id })
  },

  addTab: (cwd) => {
    const tab = buildTab(cwd)
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    }))
  },

  closeTab: (id) => {
    const state = get()
    const index = state.tabs.findIndex((tab) => tab.id === id)
    if (index < 0) return 'closed'

    const remaining = state.tabs.filter((tab) => tab.id !== id)
    if (remaining.length === 0) {
      set({ tabs: [], activeTabId: null })
      return 'hide-panel'
    }

    let activeTabId = state.activeTabId
    if (activeTabId === id) {
      const nextIndex = Math.min(index, remaining.length - 1)
      activeTabId = remaining[nextIndex]?.id ?? null
    }

    set({ tabs: remaining, activeTabId })
    return 'closed'
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  renameFromFirstCommand: (id, command) => {
    const title = titleFromFirstCommand(command)
    if (!title) return

    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id && !tab.customTitle ? { ...tab, title, customTitle: true } : tab
      )
    }))
  }
}))
