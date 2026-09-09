import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Play,
  Copy,
  RotateCcw,
  Pencil,
  Bookmark
} from 'lucide-react'
import { Button } from '../ui/button'
import { useState, useRef, useEffect, useLayoutEffect, memo, useMemo } from 'react'
import type { TimelineItem, ToolCallInfo, AgentRunOutcome, ChatFileAttachment } from '@/types'
import { cn, getFileName } from '@/lib/utils'
import { FileIcon } from '@/components/ui/FileIcon'
import { resolveMessageTimeline, segmentTimeline, type TimelineToolItem } from '@/lib/timeline'
import { MarkdownContent } from './MarkdownContent'
import { DiffView } from './DiffView'
import { parseToolFilePath } from '@/lib/parseDiff'
import { FilePathLink } from './FilePathLink'
import { ToolCallDetailView } from './ToolCallDetailView'
import { ChatImagePreview } from './ChatImagePreview'
import { ThinkingIcon, ToolTypeIcon } from './ToolTypeIcon'

const FILE_CHANGE_TOOLS = new Set(['write_file', 'search_replace'])

const COLLAPSE_TRANSITION = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const }

function CollapsibleBody({
  open,
  children,
  className
}: {
  open: boolean
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={COLLAPSE_TRANSITION}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function ExpandChevron({ expanded }: { expanded: boolean }): React.ReactElement {
  return (
    <ChevronRight
      className={cn(
        'h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ease-out',
        expanded && 'rotate-90'
      )}
    />
  )
}

function resolveToolFilePath(toolCall: ToolCallInfo): string | undefined {
  if (toolCall.filePath) return toolCall.filePath
  if (FILE_CHANGE_TOOLS.has(toolCall.name)) {
    return parseToolFilePath(toolCall.name, toolCall.arguments)
  }
  return undefined
}

export const ToolCallCard = memo(function ToolCallCard({
  toolCall
}: {
  toolCall: ToolCallInfo
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden"
    >
      <ToolCallCardHeader
        toolCall={toolCall}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
      <CollapsibleBody open={expanded}>
        <ToolCallCardBody toolCall={toolCall} />
      </CollapsibleBody>
    </motion.div>
  )
})

const ToolCallCardHeader = memo(function ToolCallCardHeader({
  toolCall,
  expanded,
  onToggle
}: {
  toolCall: ToolCallInfo
  expanded: boolean
  onToggle: () => void
}): React.ReactElement {
  const { t } = useTranslation('chat')
  const filePath = resolveToolFilePath(toolCall)
  const toolName = toolCall.name === 'preparing' ? t('tool.preparing') : toolCall.name

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left interactive-header"
      aria-expanded={expanded}
      aria-label={expanded ? t('tool.collapseDetails') : t('tool.expandDetails')}
    >
      <ToolTypeIcon toolName={toolCall.name} />
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-sm">
        <span className="shrink-0 font-medium text-zinc-200">{toolName}</span>
        {filePath && (
          <>
            <span className="shrink-0 text-zinc-500">·</span>
            <FilePathLink
              path={filePath}
              className="min-w-0 truncate"
              fileDiff={toolCall.fileDiff}
            />
          </>
        )}
      </div>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {toolCall.status === 'running' && (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
        )}
        {toolCall.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
        {toolCall.status === 'error' && <XCircle className="h-4 w-4 text-red-400" />}
        <ExpandChevron expanded={expanded} />
      </span>
    </button>
  )
}, (prev, next) =>
  prev.expanded === next.expanded &&
  prev.toolCall.id === next.toolCall.id &&
  prev.toolCall.name === next.toolCall.name &&
  prev.toolCall.status === next.toolCall.status &&
  prev.toolCall.filePath === next.toolCall.filePath &&
  prev.toolCall.fileDiff === next.toolCall.fileDiff
)

function ToolCallCardBody({ toolCall }: { toolCall: ToolCallInfo }): React.ReactElement {
  const bodyRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const isFileChange = FILE_CHANGE_TOOLS.has(toolCall.name)
  const showDiff = isFileChange && Boolean(toolCall.fileDiff || toolCall.diff)

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return

    const onScroll = (): void => {
      const distanceFromBottom = body.scrollHeight - body.scrollTop - body.clientHeight
      stickToBottomRef.current = distanceFromBottom < 24
    }

    body.addEventListener('scroll', onScroll, { passive: true })
    return () => body.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    if (toolCall.status === 'running' || showDiff) return
    const body = bodyRef.current
    if (!body || !stickToBottomRef.current) return
    body.scrollTop = body.scrollHeight
  }, [toolCall.arguments, toolCall.result, toolCall.status, showDiff])

  return (
    <div className="border-t border-white/5 px-3 py-2">
      <div ref={bodyRef} className="tool-scroll space-y-3">
        {showDiff ? (
          <DiffView
            fileDiff={toolCall.fileDiff}
            diff={toolCall.diff}
            filePath={resolveToolFilePath(toolCall)}
          />
        ) : null}

        <ToolCallDetailView toolCall={toolCall} showDiff={showDiff} />
      </div>
    </div>
  )
}

function ThinkingBlock({
  reasoning,
  isStreaming
}: {
  reasoning: string
  isStreaming?: boolean
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-violet-500/10 bg-violet-500/[0.04] overflow-hidden">
      <ThinkingBlockHeader
        isStreaming={Boolean(isStreaming)}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
      <CollapsibleBody open={expanded}>
        <ThinkingBlockBody reasoning={reasoning} isStreaming={Boolean(isStreaming)} />
      </CollapsibleBody>
    </div>
  )
}

const ThinkingBlockHeader = memo(function ThinkingBlockHeader({
  isStreaming,
  expanded,
  onToggle
}: {
  isStreaming: boolean
  expanded: boolean
  onToggle: () => void
}): React.ReactElement {
  const { t: tc } = useTranslation('common')
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left interactive-header hover:bg-violet-500/[0.06]"
      aria-expanded={expanded}
    >
      <ThinkingIcon />
      <span className="text-sm font-medium text-violet-300">{tc('status.thinking')}</span>
      {isStreaming && <Loader2 className="h-4 w-4 animate-spin text-violet-400" />}
      <div className="ml-auto">
        <ExpandChevron expanded={expanded} />
      </div>
    </button>
  )
}, (prev, next) =>
  prev.isStreaming === next.isStreaming && prev.expanded === next.expanded
)

function ThinkingBlockBody({
  reasoning,
  isStreaming
}: {
  reasoning: string
  isStreaming: boolean
}): React.ReactElement {
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
  }, [])

  useLayoutEffect(() => {
    if (isStreaming) return
    const body = bodyRef.current
    if (!body || !stickToBottomRef.current) return
    body.scrollTop = body.scrollHeight
  }, [reasoning, isStreaming])

  return (
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
  )
}

function getToolDisplayLabel(toolCall: ToolCallInfo): string {
  if (toolCall.filePath) return getFileName(toolCall.filePath)
  if (toolCall.name === 'preparing') return '…'
  return toolCall.name
}

function shouldCompactToolGroupLabels(tools: TimelineToolItem[]): boolean {
  if (tools.length <= 1) return false

  const sharedName = tools[0].toolCall.name
  if (sharedName === 'preparing') return false
  if (!tools.every((item) => item.toolCall.name === sharedName)) return false

  return tools.every((item) => {
    const filePath = resolveToolFilePath(item.toolCall)
    if (filePath) return false
    return getToolDisplayLabel(item.toolCall) === item.toolCall.name
  })
}

function toolsHeaderEqual(a: TimelineToolItem[], b: TimelineToolItem[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item, index) => {
    const left = item.toolCall
    const right = b[index].toolCall
    return (
      left.id === right.id &&
      left.name === right.name &&
      left.status === right.status &&
      left.filePath === right.filePath &&
      left.fileDiff === right.fileDiff
    )
  })
}

function ToolRunGroup({
  tools,
  isActive
}: {
  tools: TimelineToolItem[]
  isActive?: boolean
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  if (tools.length === 1) {
    return <ToolCallCard toolCall={tools[0].toolCall} />
  }

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
      <ToolRunGroupHeader
        tools={tools}
        expanded={expanded}
        isActive={Boolean(isActive)}
        onToggle={() => setExpanded((value) => !value)}
      />
      <CollapsibleBody open={expanded}>
        <div className="space-y-2 border-t border-white/5 px-2 py-2">
          {tools.map((item) => (
            <ToolCallCard key={item.id} toolCall={item.toolCall} />
          ))}
        </div>
      </CollapsibleBody>
    </div>
  )
}

const ToolRunGroupHeader = memo(function ToolRunGroupHeader({
  tools,
  expanded,
  isActive,
  onToggle
}: {
  tools: TimelineToolItem[]
  expanded: boolean
  isActive: boolean
  onToggle: () => void
}): React.ReactElement {
  const { t } = useTranslation('chat')
  const isRunning = tools.some((item) => item.toolCall.status === 'running')
  const showSpinner = isRunning || isActive
  const sharedToolName = tools.every((item) => item.toolCall.name === tools[0].toolCall.name)
    ? tools[0].toolCall.name
    : null
  const compactLabels = shouldCompactToolGroupLabels(tools)
  const title =
    sharedToolName && sharedToolName !== 'preparing'
      ? sharedToolName
      : t('tool.groupCount', { count: tools.length })

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left interactive-header"
      aria-expanded={expanded}
      aria-label={expanded ? t('tool.collapseTools') : t('tool.expandTools')}
    >
      {sharedToolName ? (
        <ToolTypeIcon toolName={sharedToolName} />
      ) : (
        <ToolTypeIcon kind="group" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-200">
          {title}
          {compactLabels && (
            <span className="ml-1.5 text-xs font-normal text-zinc-500">×{tools.length}</span>
          )}
        </div>
        {!compactLabels && (
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed">
            {tools.map((item, index) => {
              const filePath = resolveToolFilePath(item.toolCall)
              return (
                <span key={item.id} className="inline-flex items-center gap-1">
                  {index > 0 && <span className="text-zinc-600">·</span>}
                  <ToolTypeIcon toolName={item.toolCall.name} className="h-3.5 w-3.5" />
                  {filePath ? (
                    <FilePathLink
                      path={filePath}
                      fileDiff={item.toolCall.fileDiff}
                      className="text-xs"
                    />
                  ) : (
                    <span className="text-zinc-400">{getToolDisplayLabel(item.toolCall)}</span>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {showSpinner && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
        {!showSpinner && tools.every((item) => item.toolCall.status === 'done') && (
          <CheckCircle2 className="h-4 w-4 text-green-400" />
        )}
        {!showSpinner && tools.some((item) => item.toolCall.status === 'error') && (
          <XCircle className="h-4 w-4 text-red-400" />
        )}
        <ExpandChevron expanded={expanded} />
      </span>
    </button>
  )
}, (prev, next) =>
  prev.expanded === next.expanded &&
  prev.isActive === next.isActive &&
  toolsHeaderEqual(prev.tools, next.tools)
)

function TimelineDot({ className }: { className: string }): React.ReactElement {
  return (
    <span
      className={cn(
        'absolute -left-[13px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ring-2 ring-background',
        className
      )}
    />
  )
}

function StreamingPlaceholder(): React.ReactElement {
  const { t } = useTranslation('chat')
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400/70" />
      {t('message.streaming')}
    </span>
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
  const segments = useMemo(() => segmentTimeline(timeline), [timeline])
  const lastSegmentIndex = segments.length - 1

  return (
    <div className="relative space-y-3 border-l border-white/10 pl-3">
      {segments.map((segment, index) => {
        const isLastSegment = index === lastSegmentIndex

        if (segment.kind === 'reasoning') {
          return (
            <div key={segment.item.id} className="relative">
              <TimelineDot className="bg-violet-400/80" />
              <ThinkingBlock
                reasoning={segment.item.content}
                isStreaming={Boolean(
                  isStreaming && isLastSegment && segment.item.id === timeline[timeline.length - 1]?.id
                )}
              />
            </div>
          )
        }

        if (segment.kind === 'tools') {
          return (
            <div key={segment.id} className="relative">
              <TimelineDot className="bg-indigo-400/80" />
              <ToolRunGroup
                tools={segment.items}
                isActive={Boolean(isStreaming && isLastSegment)}
              />
            </div>
          )
        }

        const item = segment.item
        return (
          <div key={item.id} className="relative">
            <TimelineDot className={isError ? 'bg-red-400/80' : 'bg-emerald-400/80'} />
            {isStreaming && isLastSegment ? (
              <div
                className={cn(
                  'whitespace-pre-wrap break-words text-sm leading-relaxed',
                  isError ? 'text-red-200' : 'text-zinc-300'
                )}
              >
                {item.content}
                <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-indigo-400 animate-pulse rounded-sm" />
              </div>
            ) : (
              <MarkdownContent content={item.content} isError={isError} />
            )}
          </div>
        )
      })}

      {isStreaming && timeline.length === 0 && (
        <div className="relative">
          <TimelineDot className="bg-zinc-500" />
          <StreamingPlaceholder />
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
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  )
}

function RunOutcomeBadge({ outcome }: { outcome: AgentRunOutcome }): React.ReactElement {
  const { t } = useTranslation('chat')
  const styles: Record<AgentRunOutcome, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    aborted: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    max_iterations: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-300'
  }

  return (
    <div
      className={cn(
        'mb-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        styles[outcome]
      )}
    >
      {t(`runOutcome.${outcome}`)}
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
  attachedFiles,
  isStreaming,
  isError,
  interrupted,
  runOutcome,
  showImplementPlan,
  onImplementPlan,
  onCopy,
  onRetry,
  onEdit,
  onRemember
}: {
  role: 'user' | 'assistant'
  timeline?: TimelineItem[]
  content?: string
  reasoning?: string
  toolCalls?: ToolCallInfo[]
  images?: string[]
  attachedFiles?: ChatFileAttachment[]
  isStreaming?: boolean
  isError?: boolean
  interrupted?: boolean
  runOutcome?: AgentRunOutcome
  showImplementPlan?: boolean
  onImplementPlan?: () => void
  onCopy?: () => void
  onRetry?: () => void
  onEdit?: () => void
  onRemember?: () => void
}): React.ReactElement | null {
  const { t } = useTranslation('chat')
  const { t: tc } = useTranslation('common')
  const isUser = role === 'user'
  const resolvedTimeline = isUser
    ? []
    : timeline?.length
      ? timeline
      : resolveMessageTimeline({ content, reasoning, toolCalls, timeline })

  const hasTimeline = resolvedTimeline.length > 0
  const hasUserContent = Boolean(content?.trim()) || Boolean(images?.length) || Boolean(attachedFiles?.length)

  if (!isUser && !isStreaming && !hasTimeline && !hasUserContent) {
    return null
  }

  if (isUser) {
    const userActions = onEdit
      ? [{ label: tc('actions.edit'), icon: <Pencil className="h-3 w-3" />, onClick: onEdit }]
      : []

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="flex max-w-[90%] flex-col items-end">
          <div className="rounded-xl border border-white/10 bg-indigo-500/15 px-4 py-3 text-sm leading-relaxed text-zinc-100 ring-1 ring-inset ring-indigo-500/20">
            {images && images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((src) => (
                  <ChatImagePreview
                    key={src.slice(0, 32)}
                    src={src}
                    alt={t('message.attachmentAlt')}
                    className="border-white/20 hover:ring-white/20"
                    thumbnailClassName="max-h-32 max-w-full object-contain"
                  />
                ))}
              </div>
            )}
            {attachedFiles && attachedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachedFiles.map((file) => (
                  <div
                    key={`${file.name}-${file.content.slice(0, 24)}`}
                    className="flex max-w-[14rem] items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5"
                    title={file.name}
                  >
                    <FileIcon name={file.name} className="h-4 w-4 shrink-0 opacity-80" />
                    <span className="truncate font-mono text-[10px] text-zinc-300">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
            {content?.trim() ? <div className="whitespace-pre-wrap break-words">{content}</div> : null}
          </div>
          <MessageActions actions={userActions} align="end" />
        </div>
      </motion.div>
    )
  }

  const assistantActions = [
    ...(onCopy
      ? [{ label: tc('actions.copy'), icon: <Copy className="h-3 w-3" />, onClick: onCopy }]
      : []),
    ...(onRetry
      ? [{ label: tc('actions.retry'), icon: <RotateCcw className="h-3 w-3" />, onClick: onRetry }]
      : []),
    ...(onRemember
      ? [{ label: tc('actions.remember'), icon: <Bookmark className="h-3 w-3" />, onClick: onRemember }]
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
              : 'border border-white/10 bg-surface/40'
          )}
        >
          {runOutcome && !isStreaming && <RunOutcomeBadge outcome={runOutcome} />}
          {interrupted && !runOutcome && (
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
              {tc('status.interrupted')}
            </div>
          )}
          {hasTimeline ? (
            <TimelineView timeline={resolvedTimeline} isStreaming={isStreaming} isError={isError} />
          ) : isStreaming ? (
            <StreamingPlaceholder />
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
              {t('message.implementPlan')}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function areMessageBubblePropsEqual(
  prev: Parameters<typeof MessageBubble>[0],
  next: Parameters<typeof MessageBubble>[0]
): boolean {
  if (prev.isStreaming || next.isStreaming) return false
  return (
    prev.role === next.role &&
    prev.content === next.content &&
    prev.reasoning === next.reasoning &&
    prev.timeline === next.timeline &&
    prev.toolCalls === next.toolCalls &&
    prev.images === next.images &&
    prev.attachedFiles === next.attachedFiles &&
    prev.isError === next.isError &&
    prev.interrupted === next.interrupted &&
    prev.runOutcome === next.runOutcome &&
    prev.showImplementPlan === next.showImplementPlan
  )
}

export const MemoMessageBubble = memo(MessageBubble, areMessageBubblePropsEqual)
