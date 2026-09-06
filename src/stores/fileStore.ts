import { create } from 'zustand'
import { getLanguageFromPath } from '../lib/utils'
import type { DiffHighlightRange } from '../types'

export interface EditorTab {
  path: string
  content: string
  language: string
  isDirty: boolean
  viewMode?: 'edit' | 'preview'
}

export interface EditorRevealRequest {
  path: string
  scrollToLine: number
  highlightRanges: DiffHighlightRange[]
}

interface FileState {
  workingDirectory: string | null
  tabs: EditorTab[]
  activeTabPath: string | null
  pendingEditorReveal: EditorRevealRequest | null
  setWorkingDirectory: (path: string | null) => void
  openFile: (path: string, content: string) => void
  closeTab: (path: string) => void
  closeTabs: (paths: string[]) => void
  closeTabsToLeftOf: (path: string) => void
  closeTabsToRightOf: (path: string) => void
  closeOtherTabs: (path: string) => void
  closeTabsUnderPath: (path: string) => void
  renameTabPath: (oldPath: string, newPath: string) => void
  setActiveTab: (path: string) => void
  setTabViewMode: (path: string, viewMode: 'edit' | 'preview') => void
  updateTabContent: (path: string, content: string) => void
  replaceTabContent: (path: string, content: string) => void
  markTabSaved: (path: string) => void
  requestEditorReveal: (request: EditorRevealRequest) => void
  clearEditorReveal: () => void
  reloadCleanTabsFromDisk: () => Promise<void>
  getOpenFilesContext: () => Array<{ path: string; content: string; language: string }>
}

function pickNextActiveTab(tabs: EditorTab[], closedPath: string): string | null {
  const remaining = tabs.filter((tab) => tab.path !== closedPath)
  if (remaining.length === 0) return null

  const closedIndex = tabs.findIndex((tab) => tab.path === closedPath)

  for (let i = closedIndex + 1; i < tabs.length; i += 1) {
    if (tabs[i].path !== closedPath) return tabs[i].path
  }

  for (let i = closedIndex - 1; i >= 0; i -= 1) {
    return tabs[i].path
  }

  return remaining[0]?.path ?? null
}

function pickActiveAfterClosingTabs(
  tabs: EditorTab[],
  pathsToClose: Set<string>,
  currentActive: string | null
): string | null {
  const remaining = tabs.filter((tab) => !pathsToClose.has(tab.path))
  if (remaining.length === 0) return null
  if (currentActive && !pathsToClose.has(currentActive)) return currentActive

  const closedIndex = tabs.findIndex((tab) => tab.path === currentActive)
  if (closedIndex >= 0) {
    for (let i = closedIndex + 1; i < tabs.length; i += 1) {
      if (!pathsToClose.has(tabs[i].path)) return tabs[i].path
    }
    for (let i = closedIndex - 1; i >= 0; i -= 1) {
      if (!pathsToClose.has(tabs[i].path)) return tabs[i].path
    }
  }

  return remaining[remaining.length - 1]?.path ?? null
}

export const useFileStore = create<FileState>((set, get) => ({
  workingDirectory: null,
  tabs: [],
  activeTabPath: null,
  pendingEditorReveal: null,

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
        s.activeTabPath === path ? pickNextActiveTab(s.tabs, path) : s.activeTabPath
      return { tabs, activeTabPath }
    }),

  closeTabs: (pathsToClose) =>
    set((s) => {
      const closeSet = new Set(pathsToClose)
      const tabs = s.tabs.filter((tab) => !closeSet.has(tab.path))
      return {
        tabs,
        activeTabPath: pickActiveAfterClosingTabs(s.tabs, closeSet, s.activeTabPath)
      }
    }),

  closeTabsToLeftOf: (path) => {
    const index = get().tabs.findIndex((tab) => tab.path === path)
    if (index <= 0) return
    get().closeTabs(get().tabs.slice(0, index).map((tab) => tab.path))
  },

  closeTabsToRightOf: (path) => {
    const index = get().tabs.findIndex((tab) => tab.path === path)
    const { tabs } = get()
    if (index < 0 || index >= tabs.length - 1) return
    get().closeTabs(tabs.slice(index + 1).map((tab) => tab.path))
  },

  closeOtherTabs: (path) => {
    get().closeTabs(get().tabs.filter((tab) => tab.path !== path).map((tab) => tab.path))
  },

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

  setTabViewMode: (path, viewMode) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, viewMode } : t))
    })),

  updateTabContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, content, isDirty: true } : t
      )
    })),

  replaceTabContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, content, isDirty: false } : t
      )
    })),

  markTabSaved: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, isDirty: false } : t))
    })),

  requestEditorReveal: (request) => set({ pendingEditorReveal: request }),

  clearEditorReveal: () => set({ pendingEditorReveal: null }),

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
