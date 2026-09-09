import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Square, Trash2, RotateCcw, Paperclip, Undo2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '../ui/button'
import { MessageBubble, MemoMessageBubble } from './MessageBubble'
import { ChatModeSelector, ChatModeDescription } from './ChatModeSelector'
import { ChatImagePreview } from './ChatImagePreview'
import { useChatStore } from '@/stores/chatStore'
import { useAgent } from '@/hooks/useAgent'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFileStore } from '@/stores/fileStore'
import { useToastStore } from '@/stores/toastStore'
import { getMessageRememberContent } from '@/lib/messageRemember'
import { useChatModes } from '@/hooks/useChatModes'
import { scheduleInAnimationFrame } from '@/lib/animation-frame'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyStateShell } from '@/components/ui/EmptyStateShell'
import { ChatOnboarding } from './ChatOnboarding'
import { TokenUsageRing } from './TokenUsageRing'
import { useUiStore } from '@/stores/uiStore'
import { useAgentRunStore } from '@/stores/agentRunStore'
import { AgentContextChips } from './AgentContextChips'
import { AgentRunPanel } from './AgentRunPanel'
import { RunChangesPanel } from './RunChangesPanel'
import { FileIcon } from '@/components/ui/FileIcon'
import {
  CHAT_ATTACHMENT_MAX_COUNT,
  readChatAttachment,
  splitChatAttachments,
  type ChatInputAttachment
} from '@/lib/chatAttachments'

function StreamingMessageBubble(): React.ReactElement {
  const activeTimeline = useChatStore((s) => s.activeTimeline)
  return <MessageBubble role="assistant" timeline={activeTimeline} isStreaming />
}

function ChatAutoScroll({
  bottomRef,
  stickToBottomRef,
  wasStreamingRef,
  messageCount
}: {
  bottomRef: React.RefObject<HTMLDivElement | null>
  stickToBottomRef: React.MutableRefObject<boolean>
  wasStreamingRef: React.MutableRefObject<boolean>
  messageCount: number
}): null {
  const activeTimeline = useChatStore((s) => s.activeTimeline)
  const isStreaming = useChatStore((s) => s.isStreaming)

  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) stickToBottomRef.current = true
    wasStreamingRef.current = isStreaming
    if (stickToBottomRef.current) {
      scheduleInAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' })
      })
    }
  }, [messageCount, activeTimeline, isStreaming, bottomRef, stickToBottomRef, wasStreamingRef])

  return null
}

export function ChatPanel(): React.ReactElement {
  const { t } = useTranslation('chat')
  const { t: tc } = useTranslation('common')
  const { getModeConfig } = useChatModes()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ChatInputAttachment[]>([])
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [inputIsMultiline, setInputIsMultiline] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const MAX_INPUT_ROWS = 10
  const stickToBottomRef = useRef(true)
  const wasStreamingRef = useRef(false)
  const messages = useChatStore((s) => s.messages)
  const chatMode = useChatStore((s) => s.chatMode)
  const setChatMode = useChatStore((s) => s.setChatMode)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const updateUserMessage = useChatStore((s) => s.updateUserMessage)
  const truncateAfterMessage = useChatStore((s) => s.truncateAfterMessage)
  const { sendMessage, implementPlan, abort, retryLast } = useAgent()
  const clearMessages = useChatStore((s) => s.clearMessages)
  const settings = useSettingsStore((s) => s.settings)
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const models = useSettingsStore((s) => s.models)
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  const chatDraftFocusToken = useUiStore((s) => s.chatDraftFocusToken)
  const chatDraft = useUiStore((s) => s.chatDraft)
  const clearChatDraft = useUiStore((s) => s.clearChatDraft)
  const runCheckpoint = useAgentRunStore((s) => s.checkpoint)

  const modeConfig = getModeConfig(chatMode)
  const ModeIcon = modeConfig.icon
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.mode === chatMode || !m.mode),
    [messages, chatMode]
  )

  const selectedModel = models.find((m) => m.id === settings.model)
  const visionSupported = selectedModel?.supportsVision ?? false

  const resizeInput = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const style = window.getComputedStyle(el)
    const lineHeight = Number.parseFloat(style.lineHeight) || 20
    const padding =
      Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
    const maxHeight = lineHeight * MAX_INPUT_ROWS + padding
    const singleLineHeight = lineHeight + padding

    if (!el.value) {
      el.style.height = `${singleLineHeight}px`
      el.style.overflowY = 'hidden'
      setInputIsMultiline(false)
      return
    }

    el.style.height = '0px'
    const nextHeight = Math.max(singleLineHeight, Math.min(el.scrollHeight, maxHeight))
    el.style.height = `${nextHeight}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
    setInputIsMultiline(nextHeight > singleLineHeight + 1 || el.value.includes('\n'))
  }, [])

  useLayoutEffect(() => {
    resizeInput()
  }, [input, resizeInput])

  useEffect(() => {
    if (!chatDraft) return
    setInput(chatDraft)
    clearChatDraft()
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      resizeInput()
    })
  }, [chatDraftFocusToken, chatDraft, clearChatDraft, resizeInput])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onScroll = (): void => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      stickToBottomRef.current = distanceFromBottom < 96
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  const addAttachmentFiles = async (files: FileList | File[]): Promise<void> => {
    const list = Array.from(files)
    if (list.length === 0) return

    let remaining = CHAT_ATTACHMENT_MAX_COUNT - attachments.length
    if (remaining <= 0) {
      useToastStore.getState().addToast(t('toast.maxAttachments'), 'error')
      return
    }

    for (const file of list) {
      if (remaining <= 0) {
        useToastStore.getState().addToast(t('toast.maxAttachments'), 'error')
        break
      }

      try {
        const attachment = await readChatAttachment(file)
        if (attachment.kind === 'image' && !visionSupported) {
          useToastStore.getState().addToast(t('toast.noVision'), 'error')
          continue
        }
        setAttachments((prev) => [...prev, attachment])
        remaining -= 1
      } catch (error) {
        const code = error instanceof Error ? error.message : 'read_failed'
        if (code === 'unsupported') {
          useToastStore.getState().addToast(t('toast.unsupportedAttachment'), 'error')
        } else if (code === 'too_large') {
          useToastStore.getState().addToast(t('toast.attachmentTooLarge'), 'error')
        } else {
          useToastStore.getState().addToast(t('toast.attachmentReadFailed'), 'error')
        }
      }
    }
  }

  const handleAttachClick = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      void addAttachmentFiles(e.target.files)
    }
    e.target.value = ''
  }

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    const hasAttachments = attachments.length > 0
    if ((!text && !hasAttachments) || isStreaming) return
    if (!settings.apiKey) {
      setSettingsOpen(true)
      return
    }

    const payload = splitChatAttachments(attachments)

    if (editingMessageId) {
      truncateAfterMessage(editingMessageId)
      updateUserMessage(editingMessageId, text)
      setEditingMessageId(null)
      setInput('')
      setAttachments([])
      stickToBottomRef.current = true
      await sendMessage(text, { ...payload, skipUserMessage: true })
      return
    }

    setInput('')
    setAttachments([])
    stickToBottomRef.current = true
    await sendMessage(text, payload)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePaste = (e: React.ClipboardEvent): void => {
    const items = e.clipboardData?.items
    if (!items) return

    const pastedFiles = Array.from(items)
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))

    if (pastedFiles.length > 0) {
      e.preventDefault()
      void addAttachmentFiles(pastedFiles)
    }
  }

  const handleClear = (): void => {
    if (visibleMessages.length === 0) return
    setClearConfirmOpen(true)
  }

  const confirmClear = (): void => {
    clearMessages()
  }

  const handleRestoreRunCheckpoint = async (): Promise<void> => {
    if (isStreaming) return
    try {
      const result = await window.api.agent.restoreRunCheckpoint()
      if (!result) {
        useToastStore.getState().addToast(t('toast.nothingToRevert'), 'info')
        return
      }
      useAgentRunStore.getState().clearCheckpoint()
      await useFileStore.getState().reloadCleanTabsFromDisk()
      useToastStore.getState().addToast(
        t('toast.revertedFiles', { count: result.restored + result.deleted }),
        'success'
      )
    } catch (err) {
      useToastStore.getState().addToast(
        err instanceof Error ? err.message : t('toast.revertFailed'),
        'error'
      )
    }
  }

  const showRevertRun =
    runCheckpoint &&
    runCheckpoint.count > 0 &&
    chatMode !== 'agent'

  const handleImplementPlan = async (planContent: string): Promise<void> => {
    if (isStreaming) return
    if (!settings.apiKey) {
      setSettingsOpen(true)
      return
    }
    await implementPlan(planContent)
  }

  const copyMessage = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    useToastStore.getState().addToast(tc('toast.copiedToClipboard'), 'success')
  }

  const rememberMessage = async (message: (typeof visibleMessages)[number]): Promise<void> => {
    if (settings.projectMemoryEnabled === false) {
      useToastStore.getState().addToast(t('toast.memoryDisabled'), 'error')
      return
    }
    if (!workingDirectory) {
      useToastStore.getState().addToast(t('toast.openWorkspaceForMemory'), 'error')
      return
    }

    const content = getMessageRememberContent(message)
    if (!content) {
      useToastStore.getState().addToast(t('toast.nothingToRemember'), 'error')
      return
    }

    try {
      await window.api.memory.remember({ content, category: 'note', source: 'remember' }, workingDirectory)
      useToastStore.getState().addToast(tc('toast.addedToMemory'), 'success')
    } catch (err) {
      useToastStore.getState().addToast(
        err instanceof Error ? err.message : t('toast.memorySaveFailed'),
        'error'
      )
    }
  }

  const canRemember =
    chatMode === 'agent' &&
    settings.projectMemoryEnabled !== false &&
    Boolean(workingDirectory) &&
    !isStreaming

  return (
    <div
      className="flex h-full min-h-0 flex-col border-l border-white/5 bg-background"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer.files.length > 0) void addAttachmentFiles(e.dataTransfer.files)
      }}
    >
      <div className="chrome-header justify-between px-4">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset',
              modeConfig.theme.iconBg
            )}
          >
            <ModeIcon className={cn('h-4 w-4', modeConfig.theme.icon)} />
          </div>
          <div>
            <span className="text-sm font-medium text-zinc-200">{modeConfig.label}</span>
            <span className="ml-2 text-[10px] text-zinc-600">{t('messageCount', { count: visibleMessages.length })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showRevertRun && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-amber-300 hover:text-amber-200"
              onClick={() => void handleRestoreRunCheckpoint()}
              disabled={isStreaming}
              title={t('revertRunTitle', { count: runCheckpoint!.count })}
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="text-[10px]">{t('revertRun')}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => retryLast()}
            disabled={isStreaming}
            title={t('retryLast')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {chatMode === 'agent' && <AgentRunPanel />}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:auto]"
      >
        <div className="space-y-4 p-4">
          {visibleMessages.length === 0 && !isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <EmptyStateShell
                compact
                icon={ModeIcon}
                title={modeConfig.label}
                description={modeConfig.description}
                className="max-w-sm"
              >
                <ChatOnboarding />
              </EmptyStateShell>
            </motion.div>
          )}

          {visibleMessages.map((msg) => (
            <MemoMessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              timeline={msg.timeline}
              content={msg.content}
              reasoning={msg.reasoning}
              toolCalls={msg.toolCalls}
              images={msg.images}
              attachedFiles={msg.attachedFiles}
              isError={msg.isError}
              interrupted={msg.interrupted}
              runOutcome={msg.runOutcome}
              showImplementPlan={
                chatMode === 'planner' &&
                msg.role === 'assistant' &&
                Boolean(msg.content.trim()) &&
                !isStreaming
              }
              onImplementPlan={() => handleImplementPlan(msg.content)}
              onCopy={
                msg.role === 'assistant'
                  ? () => copyMessage(msg.content)
                  : undefined
              }
              onRetry={
                msg.role === 'assistant' && !isStreaming ? () => retryLast() : undefined
              }
              onRemember={
                canRemember && msg.role === 'assistant'
                  ? () => void rememberMessage(msg)
                  : undefined
              }
              onEdit={
                msg.role === 'user' && !isStreaming
                  ? () => {
                      setEditingMessageId(msg.id)
                      setInput(msg.content)
                    }
                  : undefined
              }
            />
          ))}

          {isStreaming && <StreamingMessageBubble />}

          <ChatAutoScroll
            bottomRef={bottomRef}
            stickToBottomRef={stickToBottomRef}
            wasStreamingRef={wasStreamingRef}
            messageCount={visibleMessages.length}
          />
          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </div>

      <div className="relative z-10 shrink-0 border-t border-white/5 p-3">
        <div
          className={cn(
            'overflow-hidden rounded-xl border border-white/10 bg-surface-elevated/20 transition-all',
            'focus-within:border-indigo-500/30 focus-within:ring-1 focus-within:ring-indigo-500/20'
          )}
        >
          {chatMode === 'agent' && <RunChangesPanel />}

          <div className="flex h-9 items-center gap-2 border-b border-white/5 bg-white/[0.02] px-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <ChatModeSelector mode={chatMode} onModeChange={setChatMode} disabled={isStreaming} />
              <ChatModeDescription mode={chatMode} />
            </div>
            <TokenUsageRing compact />
          </div>

          {chatMode === 'agent' && <AgentContextChips />}

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-white/5 px-2 py-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="relative">
                  {attachment.kind === 'image' ? (
                    <ChatImagePreview
                      src={attachment.dataUrl}
                      thumbnailClassName="h-14 w-14 object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-14 max-w-[12rem] items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5"
                      title={attachment.name}
                    >
                      <FileIcon name={attachment.name} className="h-4 w-4 shrink-0 opacity-80" />
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[10px] text-zinc-300">{attachment.name}</div>
                        {attachment.truncated && (
                          <div className="text-[9px] text-amber-400/80">{t('attachmentTruncated')}</div>
                        )}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-surface text-zinc-300 shadow-sm transition-colors hover:bg-surface-elevated hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
                    }
                    aria-label={t('removeAttachment')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className={cn(
              'relative z-10 flex gap-1 p-1.5',
              inputIsMultiline ? 'items-end' : 'items-center'
            )}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                inputRef.current?.focus()
              }
            }}
          >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-zinc-500 hover:text-zinc-300"
            onClick={handleAttachClick}
            disabled={isStreaming}
            title={t('attachFile')}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={editingMessageId ? t('editMessagePlaceholder') : modeConfig.placeholder}
            rows={1}
            className="relative z-10 min-h-[36px] flex-1 resize-none overflow-hidden bg-transparent px-1 py-2 text-sm leading-5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
          {isStreaming ? (
            <Button variant="destructive" size="icon" className="size-9 shrink-0" onClick={abort}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="size-9 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() && attachments.length === 0}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
          </div>
        </div>
        <p className="mt-2 px-1 text-[10px] text-zinc-600">
          <button
            type="button"
            className="hover:text-zinc-400 underline-offset-2 hover:underline"
            onClick={() => setShortcutsOpen(true)}
          >
            {t('shortcutSend')}
          </button>
          {' · '}
          <button
            type="button"
            className="hover:text-zinc-400 underline-offset-2 hover:underline"
            onClick={() => setShortcutsOpen(true)}
          >
            {t('shortcutNewLine')}
          </button>
          {' · '}
          <button
            type="button"
            className="hover:text-zinc-400 underline-offset-2 hover:underline"
            onClick={() => setShortcutsOpen(true)}
          >
            {t('shortcutAllKeys')}
          </button>
        </p>
      </div>

      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t('clearConfirm.title')}
        description={t('clearConfirm.description', { count: visibleMessages.length, mode: modeConfig.label })}
        confirmLabel={t('clearConfirm.confirm')}
        destructive
        onConfirm={confirmClear}
      />
    </div>
  )
}
