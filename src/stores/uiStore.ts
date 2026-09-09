import { create } from 'zustand'

interface UiState {
  shortcutsOpen: boolean
  commandPaletteOpen: boolean
  chatDraft: string | null
  chatDraftFocusToken: number
  setShortcutsOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  /** @deprecated use setCommandPaletteOpen */
  setQuickOpenOpen: (open: boolean) => void
  requestChatDraft: (text: string) => void
  clearChatDraft: () => void
}

export const useUiStore = create<UiState>((set) => ({
  shortcutsOpen: false,
  commandPaletteOpen: false,
  chatDraft: null,
  chatDraftFocusToken: 0,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setQuickOpenOpen: (open) => set({ commandPaletteOpen: open }),
  requestChatDraft: (text) =>
    set({ chatDraft: text, chatDraftFocusToken: Date.now() }),
  clearChatDraft: () => set({ chatDraft: null })
}))
