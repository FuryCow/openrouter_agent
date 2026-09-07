import { useCallback, useEffect, useRef } from 'react'
import type { ChatMessage, ChatMode } from '@/types'
import { useChatStore } from '@/stores/chatStore'
import { useFileStore } from '@/stores/fileStore'
import { useToastStore } from '@/stores/toastStore'

const MODES: ChatMode[] = ['agent', 'ask', 'planner']

async function saveAllModes(workspace: string | null): Promise<void> {
  const state = useChatStore.getState()
  for (const mode of MODES) {
    const modeMessages = state.messages.filter((m) => m.mode === mode || !m.mode)
    await window.api.chat.save(mode, modeMessages, workspace)
  }
}

async function loadWorkspaceChats(workspace: string | null): Promise<ChatMessage[]> {
  const allMessages: ChatMessage[] = []
  for (const mode of MODES) {
    const messages = await window.api.chat.load(mode, workspace)
    if (messages.length > 0) allMessages.push(...messages)
  }
  return allMessages
}

export function useChatPersistence(): void {
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const prevWorkspaceRef = useRef<string | null | undefined>(undefined)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)

  const flushSave = useCallback(async (workspace: string | null) => {
    await saveAllModes(workspace)
  }, [])

  useEffect(() => {
    const switchWorkspace = async (
      workspace: string | null,
      showToast: boolean
    ): Promise<void> => {
      const messages = await loadWorkspaceChats(workspace)
      useChatStore.getState().setAllMessages(messages)

      if (showToast && workspace) {
        const name = workspace.split(/[/\\]/).pop() || workspace
        useToastStore.getState().addToast(`Чат переключён на ${name}`, 'info')
      }
    }

    const prev = prevWorkspaceRef.current
    if (prev === undefined) {
      prevWorkspaceRef.current = workingDirectory
      void switchWorkspace(workingDirectory, false).then(() => {
        initializedRef.current = true
      })
      return
    }

    if (prev === workingDirectory) return

    void (async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await flushSave(prev)
      prevWorkspaceRef.current = workingDirectory
      await switchWorkspace(workingDirectory, true)
    })()
  }, [workingDirectory, flushSave])

  useEffect(() => {
    const unsubscribe = useChatStore.subscribe((state) => {
      if (!initializedRef.current) return
      const workspace = useFileStore.getState().workingDirectory
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        for (const mode of MODES) {
          const modeMessages = state.messages.filter((m) => m.mode === mode || !m.mode)
          void window.api.chat.save(mode, modeMessages, workspace)
        }
      }, 500)
    })

    return () => {
      unsubscribe()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])
}
