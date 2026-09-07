import { create } from 'zustand'

interface UiState {
  shortcutsOpen: boolean
  quickOpenOpen: boolean
  chatDraft: string | null
  chatDraftFocusToken: number
  setShortcutsOpen: (open: boolean) => void
  setQuickOpenOpen: (open: boolean) => void
  requestChatDraft: (text: string) => void
  clearChatDraft: () => void
}

export const useUiStore = create<UiState>((set) => ({
  shortcutsOpen: false,
  quickOpenOpen: false,
  chatDraft: null,
  chatDraftFocusToken: 0,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setQuickOpenOpen: (open) => set({ quickOpenOpen: open }),
  requestChatDraft: (text) =>
    set({ chatDraft: text, chatDraftFocusToken: Date.now() }),
  clearChatDraft: () => set({ chatDraft: null })
}))
