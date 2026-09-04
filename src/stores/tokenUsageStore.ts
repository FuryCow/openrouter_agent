import { create } from 'zustand'
import type { TokenUsage } from '@/types'

interface TokenUsageState {
  session: TokenUsage
  addUsage: (usage?: TokenUsage) => void
  resetSession: () => void
}

const emptyUsage = (): TokenUsage => ({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0
})

export const useTokenUsageStore = create<TokenUsageState>((set) => ({
  session: emptyUsage(),
  addUsage: (usage) => {
    if (!usage || usage.totalTokens <= 0) return
    set((s) => ({
      session: {
        promptTokens: s.session.promptTokens + usage.promptTokens,
        completionTokens: s.session.completionTokens + usage.completionTokens,
        totalTokens: s.session.totalTokens + usage.totalTokens
      }
    }))
  },
  resetSession: () => set({ session: emptyUsage() })
}))
