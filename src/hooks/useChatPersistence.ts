import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage } from '@/types'
import { useChatStore } from '@/stores/chatStore'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import {
  CHAT_PERSISTENCE_MODES,
  latestChatMode,
  messagesForMode,
  resolvePersistenceWorkspace
} from '@/lib/chatPersistenceCore'

const SAVE_DEBOUNCE_MS = 400

function currentPersistenceWorkspace(): string | null | undefined {
  const hydrated = useSettingsStore.getState().hydrated
  if (!hydrated) return undefined
  return resolvePersistenceWorkspace(
    hydrated,
    useFileStore.getState().workingDirectory,
    useSettingsStore.getState().settings.workingDirectory
  )
}

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
  const settingsWorkingDirectory = useSettingsStore((s) => s.settings.workingDirectory)
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const prevWorkspaceRef = useRef<string | null | undefined>(undefined)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadSeqRef = useRef(0)
  const initializedRef = useRef(false)
  const loadedWorkspaceRef = useRef<string | null | undefined>(undefined)

  const flushSave = useCallback(async (workspace: string | null) => {
    const state = useChatStore.getState()
    for (const mode of CHAT_PERSISTENCE_MODES) {
      const messages = messagesForMode(state.messages, mode)
      await window.api.chat.save(mode, messages, workspace, false)
    }
  }, [])

  const loadWorkspace = useCallback(
    async (workspace: string | null, showToast: boolean): Promise<boolean> => {
      const seq = ++loadSeqRef.current
      const messages = await loadWorkspaceChats(workspace)
      if (seq !== loadSeqRef.current) return false

      const store = useChatStore.getState()
      store.setAllMessages(messages)
      loadedWorkspaceRef.current = workspace
      if (messages.length > 0) {
        store.setChatMode(latestChatMode(messages, store.chatMode))
      }

      if (showToast && workspace) {
        const name = workspace.split(/[/\\]/).pop() || workspace
        useToastStore.getState().addToast(t('persistence.switched', { name }), 'info')
      }
      return true
    },
    [t]
  )

  useEffect(() => {
    if (!hydrated) return

    const workspace = resolvePersistenceWorkspace(
      hydrated,
      workingDirectory,
      settingsWorkingDirectory
    )
    if (workspace === undefined) return

    const prev = prevWorkspaceRef.current
    if (prev === undefined) {
      prevWorkspaceRef.current = workspace
      void loadWorkspace(workspace, false).then((ok) => {
        if (ok) initializedRef.current = true
      })
      return
    }

    if (prev === workspace) return

    void (async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (initializedRef.current) {
        await flushSave(prev)
      }
      loadedWorkspaceRef.current = undefined
      prevWorkspaceRef.current = workspace
      initializedRef.current = false
      const ok = await loadWorkspace(workspace, true)
      if (ok) initializedRef.current = true
    })()
  }, [hydrated, workingDirectory, settingsWorkingDirectory, flushSave, loadWorkspace])

  useEffect(() => {
    if (!hydrated) return

    const unsubscribe = useChatStore.subscribe((state, prev) => {
      if (state.messages === prev.messages) return
      if (!initializedRef.current) return
      const workspace = currentPersistenceWorkspace()
      if (workspace === undefined) return
      if (workspace !== loadedWorkspaceRef.current) return
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
      const workspace = currentPersistenceWorkspace()
      if (workspace === undefined) return
      if (workspace !== loadedWorkspaceRef.current) return
      await flushSave(workspace)
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
