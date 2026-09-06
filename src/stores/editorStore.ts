import { create } from 'zustand'

export interface EditorFileStats {
  path: string
  line: number
  column: number
  lineCount: number
  indent: string
  encoding: string
  eol: string
  sizeBytes: number
  language: string
  showCursor: boolean
}

interface EditorState {
  stats: EditorFileStats | null
  setStats: (stats: EditorFileStats | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  stats: null,
  setStats: (stats) => set({ stats })
}))
