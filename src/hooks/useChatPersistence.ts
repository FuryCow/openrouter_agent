import { useEffect, useRef } from 'react'
import type { ChatMode } from '@/types'
import { useChatStore } from '@/stores/chatStore'

const MODES: ChatMode[] = ['agent', 'ask', 'planner']

export function useChatPersistence(): void {
  const loadedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    void (async () => {
      for (const mode of MODES) {
        const messages = await window.api.chat.load(mode)
        if (messages.length > 0) {
          useChatStore.getState().loadMessages(mode, messages)
        }
      }
    })()
  }, [])

  useEffect(() => {
    const unsubscribe = useChatStore.subscribe((state) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        for (const mode of MODES) {
          const modeMessages = state.messages.filter((m) => m.mode === mode || !m.mode)
          void window.api.chat.save(mode, modeMessages)
        }
      }, 500)
    })

    return () => {
      unsubscribe()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])
}
