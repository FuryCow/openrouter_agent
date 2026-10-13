import { create } from 'zustand'
import type { TokenUsage } from '@/types'

interface SessionUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** Accumulated estimated cost in USD; null while no run had a known price. */
  costUsd: number | null
}

interface TokenUsageState {
  session: SessionUsage
  addUsage: (usage?: TokenUsage, costUsd?: number | null) => void
  resetSession: () => void
}

const emptyUsage = (): SessionUsage => ({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  costUsd: null
})

export const useTokenUsageStore = create<TokenUsageState>((set) => ({
  session: emptyUsage(),
  addUsage: (usage, costUsd) => {
    if (!usage || usage.totalTokens <= 0) return
    set((s) => ({
      session: {
        promptTokens: s.session.promptTokens + usage.promptTokens,
        completionTokens: s.session.completionTokens + usage.completionTokens,
        totalTokens: s.session.totalTokens + usage.totalTokens,
        // An unknown cost never resets what is already accumulated — the session
        // total stays a partial estimate instead of dropping to zero.
        costUsd:
          typeof costUsd === 'number' ? (s.session.costUsd ?? 0) + costUsd : s.session.costUsd
      }
    }))
  },
  resetSession: () => set({ session: emptyUsage() })
}))
