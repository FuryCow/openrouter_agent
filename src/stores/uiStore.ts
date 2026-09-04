import { create } from 'zustand'

interface UiState {
  shortcutsOpen: boolean
  quickOpenOpen: boolean
  setShortcutsOpen: (open: boolean) => void
  setQuickOpenOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  shortcutsOpen: false,
  quickOpenOpen: false,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setQuickOpenOpen: (open) => set({ quickOpenOpen: open })
}))
