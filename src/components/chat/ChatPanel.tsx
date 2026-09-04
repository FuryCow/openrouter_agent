import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react'
import { Send, Square, Trash2, Bot, RotateCcw, Paperclip } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '../ui/button'
import { MessageBubble } from './MessageBubble'
import { ChatModeSelector } from './ChatModeSelector'
import { useChatStore } from '@/stores/chatStore'
import { useAgent } from '@/hooks/useAgent'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { getChatModeConfig } from '@/lib/chatModes'

export function ChatPanel(): React.ReactElement {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stickToBottomRef = useRef(true)
  const wasStreamingRef = useRef(false)
  const {
    messages,
    chatMode,
    setChatMode,
    isStreaming,
    activeTimeline,
    updateUserMessage,
    truncateAfterMessage
  } = useChatStore()
  const { sendMessage, implementPlan, abort, retryLast } = useAgent()
  const clearMessages = useChatStore((s) => s.clearMessages)
  const settings = useSettingsStore((s) => s.settings)
  const models = useSettingsStore((s) => s.models)
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen)

  const modeConfig = getChatModeConfig(chatMode)
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.mode === chatMode || !m.mode),
    [messages, chatMode]
  )

  const selectedModel = models.find(
    (m) => m.id === (settings.modelsByMode?.[chatMode] || settings.model)
  )
  const visionSupported = selectedModel?.supportsVision ?? false

  const scrollToBottom = useCallback((force = false) => {
    if (!force && !stickToBottomRef.current) return
    const container = scrollRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [])

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

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const onContentChange = (): void => {
      if (stickToBottomRef.current) scrollToBottom(true)
    }
    const resizeObserver = new ResizeObserver(onContentChange)
    resizeObserver.observe(content)
    const mutationObserver = new MutationObserver(onContentChange)
    mutationObserver.observe(content, { childList: true, subtree: true, characterData: true })
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [isStreaming, scrollToBottom])

  useEffect(() => {
    if (!isStreaming) return
    let frameId = 0
    const tick = (): void => {
      if (stickToBottomRef.current) scrollToBottom(true)
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [isStreaming, scrollToBottom])

  useLayoutEffect(() => {
    if (isStreaming && !wasStreamingRef.current) stickToBottomRef.current = true
    wasStreamingRef.current = isStreaming
    if (stickToBottomRef.current) scrollToBottom(true)
  }, [visibleMessages, activeTimeline, isStreaming, scrollToBottom])

  const addImageFiles = (files: FileList | File[]): void => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) {
      useToastStore.getState().addToast('Only image files can be attached', 'error')
      return
    }
    if (!visionSupported) {
      useToastStore.getState().addToast('Current model does not support vision', 'error')
      return
    }
    list.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachments((prev) => [...prev, reader.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleAttachClick = (): void => {
    if (!visionSupported) {
      useToastStore.getState().addToast('Current model does not support vision', 'error')
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      addImageFiles(e.target.files)
    }
    e.target.value = ''
  }

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || isStreaming) return
    if (!settings.apiKey) {
      setSettingsOpen(true)
      return
    }

    if (editingMessageId) {
      truncateAfterMessage(editingMessageId)
      updateUserMessage(editingMessageId, text)
      setEditingMessageId(null)
      setInput('')
      const images = attachments.length > 0 ? attachments : undefined
      setAttachments([])
      stickToBottomRef.current = true
      await sendMessage(text, { images, skipUserMessage: true })
      return
    }

    setInput('')
    const images = attachments.length > 0 ? attachments : undefined
    setAttachments([])
    stickToBottomRef.current = true
    await sendMessage(text, { images })
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
    const imageItems = Array.from(items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean) as File[]
    if (imageItems.length > 0) {
      e.preventDefault()
      addImageFiles(imageItems)
    }
  }

  const handleClear = (): void => {
    if (!window.confirm(`Clear all ${visibleMessages.length} messages in ${modeConfig.label}?`)) return
    clearMessages()
  }

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
    useToastStore.getState().addToast('Copied to clipboard', 'success')
  }

  return (
    <div
      className="flex h-full flex-col border-l border-white/5 bg-[#0d0d14]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer.files.length > 0) addImageFiles(e.dataTransfer.files)
      }}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
            <Bot className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-sm font-medium text-zinc-200">Chat</span>
            <span className="ml-2 text-[10px] text-zinc-600">{visibleMessages.length} msgs</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => retryLast()}
            disabled={isStreaming}
            title="Retry last"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={contentRef} className="space-y-4 p-4">
          {visibleMessages.length === 0 && !isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-white/5">
                <modeConfig.icon className={`h-8 w-8 ${modeConfig.accentClass} opacity-60`} />
              </div>
              <h3 className="text-sm font-medium text-zinc-300">{modeConfig.label}</h3>
              <p className="mt-1 max-w-xs text-xs text-zinc-500">{modeConfig.description}</p>
            </motion.div>
          )}

          {visibleMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              timeline={msg.timeline}
              content={msg.content}
              reasoning={msg.reasoning}
              toolCalls={msg.toolCalls}
              images={msg.images}
              isError={msg.isError}
              interrupted={msg.interrupted}
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

          {isStreaming && (
            <MessageBubble role="assistant" timeline={activeTimeline} isStreaming />
          )}

          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </div>

      <div className="border-t border-white/5 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <ChatModeSelector mode={chatMode} onModeChange={setChatMode} disabled={isStreaming} />
        </div>

        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt="" className="h-14 w-14 rounded-md object-cover border border-white/10" />
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full bg-zinc-800 px-1 text-[10px] text-zinc-300"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1.5 focus-within:border-indigo-500/30 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
            title={visionSupported ? 'Attach image' : 'Vision not supported by current model'}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={editingMessageId ? 'Edit message…' : modeConfig.placeholder}
            rows={1}
            className="flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none min-h-9 max-h-32"
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
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
