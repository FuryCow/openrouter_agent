import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage } from '@/types'
import { useChatStore } from '@/stores/chatStore'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { CHAT_PERSISTENCE_MODES, messagesForMode } from '@/lib/chatPersistenceCore'

const SAVE_DEBOUNCE_MS = 400

async function loadWorkspaceChats(workspace: string | null): Promise<ChatMessage[]> {
  const allMessages: ChatMessage[] = []
  for (const mode of CHAT_PERSISTENCE_MODES) {
    const messages = await window.api.chat.load(mode, workspace)
    if (messages.length > 0) allMessages.push(...messages)
  }
  return allMessages
}

export function useChatPersistence(): void {
  const { t } = useTranslation('chat')
  const hydrated = useSettingsStore((s) => s.hydrated)
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const prevWorkspaceRef = useRef<string | null | undefined>(undefined)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadSeqRef = useRef(0)
  const initializedRef = useRef(false)

  const flushSave = useCallback(async (workspace: string | null) => {
    const state = useChatStore.getState()
    for (const mode of CHAT_PERSISTENCE_MODES) {
      await window.api.chat.save(mode, messagesForMode(state.messages, mode), workspace)
    }
  }, [])

  const loadWorkspace = useCallback(
    async (workspace: string | null, showToast: boolean): Promise<void> => {
      const seq = ++loadSeqRef.current
      const messages = await loadWorkspaceChats(workspace)
      if (seq !== loadSeqRef.current) return

      useChatStore.getState().setAllMessages(messages)

      if (showToast && workspace) {
        const name = workspace.split(/[/\\]/).pop() || workspace
        useToastStore.getState().addToast(t('persistence.switched', { name }), 'info')
      }
    },
    [t]
  )

  useEffect(() => {
    if (!hydrated) return

    const prev = prevWorkspaceRef.current
    if (prev === undefined) {
      prevWorkspaceRef.current = workingDirectory
      void loadWorkspace(workingDirectory, false).then(() => {
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
      await loadWorkspace(workingDirectory, true)
    })()
  }, [hydrated, workingDirectory, flushSave, loadWorkspace])

  useEffect(() => {
    if (!hydrated) return

    const unsubscribe = useChatStore.subscribe(() => {
      if (!initializedRef.current) return
      const workspace = useFileStore.getState().workingDirectory
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void flushSave(workspace)
      }, SAVE_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [hydrated, flushSave])

  useEffect(() => {
    if (!hydrated) return

    const flushNow = async (): Promise<void> => {
      if (!initializedRef.current) return
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await flushSave(useFileStore.getState().workingDirectory)
    }

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        void flushNow()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    const unsubFlush = window.api.app.onFlushRequest(() => {
      void flushNow().finally(() => {
        window.api.app.flushComplete()
      })
    })

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      unsubFlush()
    }
  }, [hydrated, flushSave])
}
