import { create } from 'zustand'
import { getLanguageFromPath } from '../lib/utils'

export interface EditorTab {
  path: string
  content: string
  language: string
  isDirty: boolean
}

interface FileState {
  workingDirectory: string | null
  tabs: EditorTab[]
  activeTabPath: string | null
  setWorkingDirectory: (path: string | null) => void
  openFile: (path: string, content: string) => void
  closeTab: (path: string) => void
  closeTabsUnderPath: (path: string) => void
  renameTabPath: (oldPath: string, newPath: string) => void
  setActiveTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
  markTabSaved: (path: string) => void
  reloadCleanTabsFromDisk: () => Promise<void>
  getOpenFilesContext: () => Array<{ path: string; content: string; language: string }>
}

export const useFileStore = create<FileState>((set, get) => ({
  workingDirectory: null,
  tabs: [],
  activeTabPath: null,

  setWorkingDirectory: (path) => set({ workingDirectory: path }),

  openFile: (path, content) =>
    set((s) => {
      const existing = s.tabs.find((t) => t.path === path)
      if (existing) {
        return { activeTabPath: path }
      }
      return {
        tabs: [
          ...s.tabs,
          {
            path,
            content,
            language: getLanguageFromPath(path),
            isDirty: false
          }
        ],
        activeTabPath: path
      }
    }),

  closeTab: (path) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.path !== path)
      const activeTabPath =
        s.activeTabPath === path
          ? tabs[tabs.length - 1]?.path || null
          : s.activeTabPath
      return { tabs, activeTabPath }
    }),

  closeTabsUnderPath: (path) =>
    set((s) => {
      const normalized = path.replace(/\\/g, '/')
      const tabs = s.tabs.filter((t) => {
        const tabPath = t.path.replace(/\\/g, '/')
        return tabPath !== normalized && !tabPath.startsWith(`${normalized}/`)
      })
      const activeTabPath = tabs.some((t) => t.path === s.activeTabPath)
        ? s.activeTabPath
        : tabs[tabs.length - 1]?.path || null
      return { tabs, activeTabPath }
    }),

  renameTabPath: (oldPath, newPath) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === oldPath
          ? { ...t, path: newPath, language: getLanguageFromPath(newPath) }
          : t
      ),
      activeTabPath: s.activeTabPath === oldPath ? newPath : s.activeTabPath
    })),

  setActiveTab: (path) => set({ activeTabPath: path }),

  updateTabContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, content, isDirty: true } : t
      )
    })),

  markTabSaved: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, isDirty: false } : t))
    })),

  reloadCleanTabsFromDisk: async () => {
    const { tabs } = get()
    const updates: Array<{ path: string; content: string }> = []

    for (const tab of tabs) {
      if (tab.isDirty) continue
      try {
        const content = await window.api.fs.readFile(tab.path)
        if (content !== tab.content) {
          updates.push({ path: tab.path, content })
        }
      } catch {
        // File may have been deleted
      }
    }

    if (updates.length === 0) return

    set((s) => ({
      tabs: s.tabs.map((t) => {
        const update = updates.find((u) => u.path === t.path)
        return update ? { ...t, content: update.content, isDirty: false } : t
      })
    }))
  },

  getOpenFilesContext: () => {
    const { tabs } = get()
    return tabs.map((t) => ({
      path: t.path,
      content: t.content,
      language: t.language
    }))
  }
}))
