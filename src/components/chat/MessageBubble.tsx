import { motion } from 'framer-motion'
import {
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Brain,
  Play,
  Copy,
  RotateCcw,
  Pencil
} from 'lucide-react'
import { Button } from '../ui/button'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import type { TimelineItem, ToolCallInfo } from '@/types'
import { cn } from '@/lib/utils'
import { resolveMessageTimeline } from '@/lib/timeline'
import { MarkdownContent } from './MarkdownContent'
import { DiffView } from './DiffView'
import { parseToolFilePath } from '@/lib/parseDiff'
import { FilePathLink } from './FilePathLink'

const FILE_CHANGE_TOOLS = new Set(['write_file', 'search_replace'])

const toolIcons: Record<string, string> = {
  read_file: '📄',
  write_file: '✏️',
  search_replace: '🩹',
  list_directory: '📁',
  search_files: '🔍',
  run_terminal: '💻',
  web_search: '🌐',
  get_open_files: '📋'
}

export function ToolCallCard({ toolCall }: { toolCall: ToolCallInfo }): React.ReactElement {
  const [expanded, setExpanded] = useState(toolCall.status === 'running')
  const bodyRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const isFileChange = FILE_CHANGE_TOOLS.has(toolCall.name)
  const filePath =
    toolCall.filePath ?? (isFileChange ? parseToolFilePath(toolCall.name, toolCall.arguments) : undefined)
  const showDiff = isFileChange && Boolean(toolCall.fileDiff || toolCall.diff)

  useEffect(() => {
    if (toolCall.status === 'running') {
      setExpanded(true)
      stickToBottomRef.current = true
    }
  }, [toolCall.status, toolCall.arguments])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const onScroll = (): void => {
      const distanceFromBottom = body.scrollHeight - body.scrollTop - body.clientHeight
      stickToBottomRef.current = distanceFromBottom < 24
    }

    body.addEventListener('scroll', onScroll, { passive: true })
    return () => body.removeEventListener('scroll', onScroll)
  }, [expanded])

  useLayoutEffect(() => {
    if (!expanded || toolCall.status !== 'running' || showDiff) return
    const body = bodyRef.current
    if (!body || !stickToBottomRef.current) return
    body.scrollTop = body.scrollHeight
  }, [toolCall.arguments, toolCall.result, toolCall.status, expanded, showDiff])

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-sm">{toolIcons[toolCall.name] || '🔧'}</span>
        <Wrench className="h-3 w-3 text-indigo-400" />
        <span className="min-w-0 flex-1 text-xs font-medium text-zinc-300">
          {toolCall.name === 'preparing' ? 'Подготовка tool call…' : toolCall.name}
          {filePath && (
            <>
              <span className="text-zinc-500"> · </span>
              <FilePathLink path={filePath} className="ml-1 truncate" fileDiff={toolCall.fileDiff} />
            </>
          )}
          {toolCall.status === 'running' && !filePath && toolCall.arguments.length > 0 && (
            <span className="ml-1 text-zinc-500">({toolCall.arguments.length} chars)</span>
          )}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {toolCall.status === 'running' && (
            <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
          )}
          {toolCall.status === 'done' && (
            <CheckCircle2 className="h-3 w-3 text-green-400" />
          )}
          {toolCall.status === 'error' && (
            <XCircle className="h-3 w-3 text-red-400" />
          )}
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-zinc-500" />
          ) : (
            <ChevronRight className="h-3 w-3 text-zinc-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-3 py-2">
          <div ref={bodyRef} className={cn('space-y-2', !showDiff && 'tool-scroll')}>
            {showDiff ? (
              <DiffView fileDiff={toolCall.fileDiff} diff={toolCall.diff} />
            ) : isFileChange && toolCall.status === 'running' ? (
              <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-words">
                {toolCall.arguments || 'Генерация аргументов…'}
              </pre>
            ) : (
              <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-words">
                {toolCall.arguments ||
                  (toolCall.status === 'running' ? 'Генерация аргументов…' : '')}
              </pre>
            )}

            {toolCall.result && (
              <p
                className={cn(
                  'text-[10px] font-mono',
                  toolCall.status === 'error' ? 'text-red-300' : 'text-zinc-500'
                )}
              >
                {toolCall.result.slice(0, 2000)}
                {toolCall.result.length > 2000 && '...'}
              </p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function ThinkingBlock({
  reasoning,
  isStreaming
}: {
  reasoning: string
  isStreaming?: boolean
}): React.ReactElement {
  const [expanded, setExpanded] = useState(true)
  const bodyRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    if (isStreaming) {
      stickToBottomRef.current = true
    }
  }, [isStreaming])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const onScroll = (): void => {
      const distanceFromBottom = body.scrollHeight - body.scrollTop - body.clientHeight
      stickToBottomRef.current = distanceFromBottom < 40
    }

    body.addEventListener('scroll', onScroll, { passive: true })
    return () => body.removeEventListener('scroll', onScroll)
  }, [expanded])

  useLayoutEffect(() => {
    if (!expanded) return
    const body = bodyRef.current
    if (!body) return
    if (isStreaming && stickToBottomRef.current) {
      body.scrollTop = body.scrollHeight
    }
  }, [reasoning, isStreaming, expanded])

  return (
    <div className="rounded-lg border border-violet-500/10 bg-violet-500/[0.04] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-violet-500/[0.06] transition-colors"
      >
        <Brain className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-medium text-violet-300">Thinking</span>
        {isStreaming && <Loader2 className="h-3 w-3 animate-spin text-violet-400" />}
        <div className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-zinc-500" />
          ) : (
            <ChevronRight className="h-3 w-3 text-zinc-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-violet-500/10 px-3 py-2">
          <div
            ref={bodyRef}
            className="thinking-scroll text-xs leading-relaxed text-zinc-500 whitespace-pre-wrap break-words font-mono"
          >
            {reasoning}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3 ml-0.5 bg-violet-400 animate-pulse rounded-sm" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TimelineView({
  timeline,
  isStreaming,
  isError
}: {
  timeline: TimelineItem[]
  isStreaming?: boolean
  isError?: boolean
}): React.ReactElement {
  const lastItem = timeline[timeline.length - 1]

  return (
    <div className="relative space-y-3 border-l border-white/10 pl-3">
      {timeline.map((item, index) => {
        const isLast = index === timeline.length - 1

        if (item.type === 'reasoning') {
          return (
            <div key={item.id} className="relative">
              <span className="absolute -left-[13px] top-3 h-2 w-2 rounded-full bg-violet-400/80 ring-2 ring-[#0d0d14]" />
              <ThinkingBlock
                reasoning={item.content}
                isStreaming={Boolean(isStreaming && isLast && item.type === lastItem?.type)}
              />
            </div>
          )
        }

        if (item.type === 'tool') {
          return (
            <div key={item.id} className="relative">
              <span className="absolute -left-[13px] top-3 h-2 w-2 rounded-full bg-indigo-400/80 ring-2 ring-[#0d0d14]" />
              <ToolCallCard toolCall={item.toolCall} />
            </div>
          )
        }

        return (
          <div key={item.id} className="relative">
            <span
              className={cn(
                'absolute -left-[13px] top-3 h-2 w-2 rounded-full ring-2 ring-[#0d0d14]',
                isError ? 'bg-red-400/80' : 'bg-emerald-400/80'
              )}
            />
            {isStreaming ? (
              <div
                className={cn(
                  'whitespace-pre-wrap break-words text-sm leading-relaxed',
                  isError ? 'text-red-200' : 'text-zinc-300'
                )}
              >
                {item.content}
              </div>
            ) : (
              <MarkdownContent content={item.content} isError={isError} />
            )}
            {isStreaming && isLast && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse rounded-sm align-text-bottom" />
            )}
          </div>
        )
      })}

      {isStreaming && timeline.length === 0 && (
        <div className="relative">
          <span className="absolute -left-[13px] top-3 h-2 w-2 rounded-full bg-zinc-500 ring-2 ring-[#0d0d14]" />
          <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Working...
          </span>
        </div>
      )}
    </div>
  )
}

function MessageActions({
  actions,
  align = 'start'
}: {
  actions: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>
  align?: 'start' | 'end'
}): React.ReactElement | null {
  if (actions.length === 0) return null

  return (
    <div
      className={cn(
        'mt-1 flex flex-wrap gap-2',
        align === 'end' ? 'justify-end' : 'justify-start'
      )}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  )
}

export function MessageBubble({
  role,
  timeline,
  content,
  reasoning,
  toolCalls,
  images,
  isStreaming,
  isError,
  interrupted,
  showImplementPlan,
  onImplementPlan,
  onCopy,
  onRetry,
  onEdit
}: {
  role: 'user' | 'assistant'
  timeline?: TimelineItem[]
  content?: string
  reasoning?: string
  toolCalls?: ToolCallInfo[]
  images?: string[]
  isStreaming?: boolean
  isError?: boolean
  interrupted?: boolean
  showImplementPlan?: boolean
  onImplementPlan?: () => void
  onCopy?: () => void
  onRetry?: () => void
  onEdit?: () => void
}): React.ReactElement | null {
  const isUser = role === 'user'
  const resolvedTimeline = isUser
    ? []
    : timeline?.length
      ? timeline
      : resolveMessageTimeline({ content, reasoning, toolCalls, timeline })

  const hasTimeline = resolvedTimeline.length > 0
  const hasUserContent = Boolean(content?.trim())

  if (!isUser && !isStreaming && !hasTimeline && !hasUserContent) {
    return null
  }

  if (isUser) {
    const userActions = onEdit
      ? [{ label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: onEdit }]
      : []

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="flex max-w-[90%] flex-col items-end">
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-sm leading-relaxed text-white shadow-lg shadow-indigo-500/10">
            {images && images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((src) => (
                  <img
                    key={src.slice(0, 32)}
                    src={src}
                    alt="attachment"
                    className="max-h-32 rounded-md border border-white/20"
                  />
                ))}
              </div>
            )}
            <div className="whitespace-pre-wrap break-words">{content}</div>
          </div>
          <MessageActions actions={userActions} align="end" />
        </div>
      </motion.div>
    )
  }

  const assistantActions = [
    ...(onCopy
      ? [{ label: 'Copy', icon: <Copy className="h-3 w-3" />, onClick: onCopy }]
      : []),
    ...(onRetry
      ? [{ label: 'Retry', icon: <RotateCcw className="h-3 w-3" />, onClick: onRetry }]
      : [])
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start"
    >
      <div className="flex max-w-[90%] flex-col items-start">
        <div
          className={cn(
            'w-full rounded-xl px-4 py-3',
            isError
              ? 'bg-red-500/[0.08] border border-red-500/20'
              : 'bg-white/[0.03] border border-white/5'
          )}
        >
          {interrupted && (
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
              Interrupted
            </div>
          )}
          {hasTimeline ? (
            <TimelineView timeline={resolvedTimeline} isStreaming={isStreaming} isError={isError} />
          ) : isStreaming ? (
            <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Working...
            </span>
          ) : null}
        </div>

        <MessageActions actions={assistantActions} align="start" />

        {showImplementPlan && onImplementPlan && content?.trim() && (
          <div className="mt-1">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 border border-amber-500/20"
              onClick={onImplementPlan}
            >
              <Play className="h-3.5 w-3.5" />
              Реализовать согласно плану
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
