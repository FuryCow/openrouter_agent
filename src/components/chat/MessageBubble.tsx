import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Loader2,
  ChevronRight,
  Play,
  Save,
  Copy,
  RotateCcw,
  Pencil,
  Bookmark,
  FlaskConical
} from 'lucide-react'
import { Button } from '../ui/button'
import { useState, useRef, useEffect, useLayoutEffect, memo, useMemo } from 'react'
import type { TimelineItem, ToolCallInfo, AgentRunOutcome, ChatFileAttachment } from '@/types'
import { cn, getFileName } from '@/lib/utils'
import { FileIcon } from '@/components/ui/FileIcon'
import { resolveMessageTimeline, segmentTimeline, type TimelineToolItem } from '@/lib/timeline'
import {
  buildToolSummarySegments,
  formatCompactToolSummaryLabel,
  resolveToolFilePath,
  type ToolSummarySegment
} from '@/lib/toolGroupSummary'
import { MarkdownContent } from './MarkdownContent'
import { DiffView } from './DiffView'
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

function ExpandChevron({ expanded, className }: { expanded: boolean; className?: string }): React.ReactElement {
  return (
    <ChevronRight
      className={cn(
        'h-3 w-3 shrink-0 text-zinc-500 transition-transform duration-200 ease-out',
        expanded && 'rotate-90',
        className
      )}
    />
  )
}

/** Quiet status indicator: pulsing dot while running, red on error, silence on success. */
function StatusDot({ status }: { status: ToolCallInfo['status'] }): React.ReactElement | null {
  if (status === 'running') {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400 animate-pulse" />
  }
  if (status === 'error') {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
  }
  return null
}

export const ToolCallCard = memo(function ToolCallCard({
  toolCall
}: {
  toolCall: ToolCallInfo
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <ToolCallCardHeader
        toolCall={toolCall}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
      <CollapsibleBody open={expanded}>
        <div className="pb-1 pl-2">
          <ToolCallCardBody toolCall={toolCall} />
        </div>
      </CollapsibleBody>
    </div>
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
  const isPreparing = toolCall.name === 'preparing'
  const verb = isPreparing
    ? t('tool.preparing')
    : t(`tool.shortNames.${toolCall.name}`, { defaultValue: toolCall.name })

  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-white/[0.04]"
      aria-expanded={expanded}
      aria-label={expanded ? t('tool.collapseDetails') : t('tool.expandDetails')}
    >
      <ToolTypeIcon toolName={toolCall.name} className="h-4 w-4" />
      <span className="shrink-0 text-[13px] text-zinc-500">{verb}</span>
      {filePath && (
        <FilePathLink
          path={filePath}
          className="min-w-0 truncate text-[13px] font-medium text-zinc-200"
          fileDiff={toolCall.fileDiff}
        />
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <StatusDot status={toolCall.status} />
        <ExpandChevron expanded={expanded} className="text-zinc-600" />
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
    <div className="px-1 pb-1.5 pt-0.5">
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
  const { t } = useTranslation('chat')
  const label = isStreaming ? t('tool.thinkingStreaming') : t('tool.thoughtProcess')

  return (
    <div>
      <ThinkingBlockHeader
        label={label}
        isStreaming={Boolean(isStreaming)}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
      <CollapsibleBody open={expanded}>
        <div className="pb-1 pl-2">
          <ThinkingBlockBody reasoning={reasoning} isStreaming={Boolean(isStreaming)} />
        </div>
      </CollapsibleBody>
    </div>
  )
}

const ThinkingBlockHeader = memo(function ThinkingBlockHeader({
  label,
  isStreaming,
  expanded,
  onToggle
}: {
  label: string
  isStreaming: boolean
  expanded: boolean
  onToggle: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-white/[0.04]"
      aria-expanded={expanded}
    >
      <ThinkingIcon className="h-4 w-4" />
      <span className="text-[13px] text-zinc-500">{label}</span>
      {isStreaming && <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />}
      <ExpandChevron expanded={expanded} className="ml-auto text-zinc-600" />
    </button>
  )
}, (prev, next) =>
  prev.label === next.label &&
  prev.isStreaming === next.isStreaming &&
  prev.expanded === next.expanded
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
    <div className="px-1 pb-1.5 pt-0.5">
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
  const toolCount = countToolCalls(tools)

  // Finished groups collapse into a single "Ran N tools" line.
  if (!isActive) {
    return <HistoryGroup items={tools} toolCount={toolCount} />
  }

  // Active (streaming) group stays expanded as a live log.
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null)
  const expanded = userExpanded ?? tools.length <= 4

  if (tools.length === 1) {
    return <ToolCallCard toolCall={tools[0].toolCall} />
  }

  return (
    <div>
      <ToolRunGroupHeader
        tools={tools}
        expanded={expanded}
        isActive
        onToggle={() => setUserExpanded(!expanded)}
      />
      <CollapsibleBody open={expanded}>
        <div className="space-y-px">
          {tools.map((item) => (
            <ToolCallCard key={item.id} toolCall={item.toolCall} />
          ))}
        </div>
      </CollapsibleBody>
    </div>
  )
}

function ToolSummarySegmentContent({
  segment,
  t
}: {
  segment: ToolSummarySegment
  t: TFunction<'chat'>
}): React.ReactElement {
  if (segment.kind === 'compact') {
    return (
      <>
        <ToolTypeIcon toolName={segment.toolName} className="h-3.5 w-3.5" />
        <span className="text-zinc-400">
          {formatCompactToolSummaryLabel(segment.toolName, segment.count, segment.filePath, t)}
        </span>
      </>
    )
  }

  const filePath = resolveToolFilePath(segment.item.toolCall)
  const verb = t(`tool.shortNames.${segment.item.toolCall.name}`, {
    defaultValue: segment.item.toolCall.name
  })
  return (
    <>
      <ToolTypeIcon toolName={segment.item.toolCall.name} className="h-3.5 w-3.5" />
      {filePath ? (
        <FilePathLink
          path={filePath}
          fileDiff={segment.item.toolCall.fileDiff}
          className="text-[13px]"
        />
      ) : (
        <span className="text-zinc-400">{verb}</span>
      )}
    </>
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
  const summarySegments = useMemo(() => buildToolSummarySegments(tools), [tools])

  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-white/[0.04]"
      aria-expanded={expanded}
      aria-label={expanded ? t('tool.collapseTools') : t('tool.expandTools')}
    >
      {sharedToolName ? (
        <ToolTypeIcon toolName={sharedToolName} className="h-4 w-4" />
      ) : (
        <ToolTypeIcon kind="group" className="h-4 w-4" />
      )}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-none">
        {summarySegments.map((segment, index) => (
          <span key={segment.key} className="inline-flex items-center gap-1.5">
            {index > 0 && <span className="text-zinc-600">·</span>}
            <ToolSummarySegmentContent segment={segment} t={t} />
          </span>
        ))}
      </div>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {showSpinner && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />}
        {!showSpinner && tools.some((item) => item.toolCall.status === 'error') && (
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        )}
        <ExpandChevron expanded={expanded} className="text-zinc-600" />
      </span>
    </button>
  )
}, (prev, next) =>
  prev.expanded === next.expanded &&
  prev.isActive === next.isActive &&
  toolsHeaderEqual(prev.tools, next.tools)
)

function StreamingPlaceholder(): React.ReactElement {
  const { t } = useTranslation('chat')
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
      {t('message.streaming')}
    </span>
  )
}

function countChangedFiles(tools: TimelineToolItem[]): number {
  const paths = new Set<string>()
  for (const item of tools) {
    if (!FILE_CHANGE_TOOLS.has(item.toolCall.name)) continue
    const filePath = resolveToolFilePath(item.toolCall)
    if (filePath) paths.add(filePath)
  }
  return paths.size
}

function countToolCalls(tools: TimelineToolItem[]): number {
  return tools.filter((item) => item.toolCall.name !== 'preparing').length
}

/**
 * Finished-run view: each tool batch collapses into its own "Ran N tools"
 * line, model text stays visible between them — the chronological
 * narrative (tools → text → tools → text) is preserved.
 */
function FinishedRunView({
  timeline,
  fallbackText,
  isError
}: {
  timeline: TimelineItem[]
  fallbackText?: string
  isError?: boolean
}): React.ReactElement {
  const segments = useMemo(() => segmentTimeline(timeline), [timeline])

  // Trailing text = the final answer, rendered outside any collapsible.
  let cut = segments.length
  while (cut > 0 && segments[cut - 1].kind === 'text') cut -= 1
  const activitySegments = segments.slice(0, cut)
  let finalSegments = segments.slice(cut)
  if (finalSegments.length === 0 && !timeline.some((item) => item.type === 'text') && fallbackText?.trim()) {
    finalSegments = [
      {
        kind: 'text',
        item: { id: 'final-text-fallback', type: 'text' as const, content: fallbackText }
      }
    ]
  }

  return (
    <div className="space-y-1.5">
      {activitySegments.map((segment) => {
        if (segment.kind === 'tools') {
          return <ToolRunGroup key={segment.id} tools={segment.items} />
        }
        if (segment.kind === 'reasoning') {
          return <ThinkingBlock key={segment.item.id} reasoning={segment.item.content} />
        }
        return (
          <div key={segment.item.id} className="py-0.5">
            <MarkdownContent content={segment.item.content} isError={isError} />
          </div>
        )
      })}
      {finalSegments.map((segment) =>
        segment.kind === 'text' ? (
          <div key={segment.item.id} className="py-0.5">
            <MarkdownContent content={segment.item.content} isError={isError} />
          </div>
        ) : null
      )}
    </div>
  )
}

/**
 * Expanded run history: a flat chronological list — one row per action
 * (tool or thinking), all from the same left edge, no group headers.
 */
function ActivityFlatList({ items }: { items: TimelineItem[] }): React.ReactElement {
  return (
    <div className="space-y-px pb-1">
      {items.map((item) => {
        if (item.type === 'tool') {
          return <ToolCallCard key={item.id} toolCall={item.toolCall} />
        }
        if (item.type === 'reasoning') {
          return <ThinkingBlock key={item.id} reasoning={item.content} />
        }
        return (
          <div key={item.id} className="pl-2 py-0.5 text-[13px] text-zinc-400">
            <MarkdownContent content={item.content} />
          </div>
        )
      })}
    </div>
  )
}

function TimelineView({
  timeline,
  fallbackText,
  isStreaming,
  isError
}: {
  timeline: TimelineItem[]
  fallbackText?: string
  isStreaming?: boolean
  isError?: boolean
}): React.ReactElement {
  if (!isStreaming) {
    return (
      <FinishedRunView
        timeline={timeline}
        fallbackText={fallbackText}
        isError={isError}
      />
    )
  }

  const segments = useMemo(() => segmentTimeline(timeline), [timeline])
  const lastSegmentIndex = segments.length - 1
  // While streaming, only the last segment is the live part; everything
  // earlier collapses into a clickable "Ran N tools" summary.
  const historyEnd = lastSegmentIndex > 0 ? lastSegmentIndex : 0
  const historySegments = segments.slice(0, historyEnd)
  const liveSegments = segments.slice(historyEnd)

  const historyItems: TimelineItem[] = historySegments.flatMap((segment) =>
    segment.kind === 'tools' ? segment.items.map((item) => item) : [segment.item]
  )
  const historyToolCount = historyItems.filter((item) => item.type === 'tool').length

  return (
    <div className="space-y-1.5">
      {historyItems.length > 0 && (
        <HistoryGroup items={historyItems} toolCount={historyToolCount} />
      )}

      {liveSegments.map((segment) => {
        if (segment.kind === 'reasoning') {
          return <ThinkingBlock key={segment.item.id} reasoning={segment.item.content} isStreaming />
        }

        if (segment.kind === 'tools') {
          return <ToolRunGroup key={segment.id} tools={segment.items} isActive />
        }

        const item = segment.item
        return (
          <div
            key={item.id}
            className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-100"
          >
            {item.content}
            <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-indigo-400 animate-pulse rounded-sm" />
          </div>
        )
      })}

      {timeline.length === 0 && <StreamingPlaceholder />}
    </div>
  )
}

/**
 * Collapsed history of earlier activity: one clickable "Ran N tools" line
 * that expands into the flat chronological list. Used both mid-run
 * (everything except the live segment) and after completion (RunSummary).
 */
function HistoryGroup({
  items,
  toolCount
}: {
  items: TimelineItem[]
  toolCount: number
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation('chat')

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="group flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-white/[0.04]"
        aria-expanded={expanded}
      >
        <ToolTypeIcon kind="group" className="h-4 w-4" />
        <span className="text-[13px] text-zinc-500">
          {t('tool.runSummaryTools', { count: toolCount })}
        </span>
        <ExpandChevron expanded={expanded} className="ml-auto text-zinc-600" />
      </button>
      <CollapsibleBody open={expanded}>
        <ActivityFlatList items={items} />
      </CollapsibleBody>
    </div>
  )
}

function MessageActions({
  actions,
  align = 'start'
}: {
  actions: Array<{ label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }>
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
          disabled={action.disabled}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30',
            'disabled:pointer-events-none disabled:opacity-60'
          )}
        >
          {action.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : action.icon}
          {action.label}
        </button>
      ))}
    </div>
  )
}

function RunOutcomeBadge({ outcome }: { outcome: AgentRunOutcome }): React.ReactElement {
  const { t } = useTranslation('chat')
  const styles: Record<AgentRunOutcome, string> = {
    success: 'text-emerald-400/90',
    aborted: 'text-amber-400/90',
    max_iterations: 'text-amber-400/90',
    error: 'text-red-400/90'
  }
  const marks: Record<AgentRunOutcome, string> = {
    success: '✓',
    aborted: '⚠',
    max_iterations: '⚠',
    error: '✕'
  }

  // Success is the norm — silence. Only exceptional outcomes get a line.
  if (outcome === 'success') {
    return <span />
  }

  return (
    <div className={cn('mb-1 inline-flex h-7 items-center gap-2.5 pl-2 text-xs', styles[outcome])}>
      <span aria-hidden className="inline-flex w-4 shrink-0 items-center justify-center">
        {marks[outcome]}
      </span>
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
  showSavePlan,
  onSavePlan,
  onCopy,
  onRetry,
  onEdit,
  onRemember,
  onDistill,
  canDistill,
  distillBusy,
  distillActive
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
  showSavePlan?: boolean
  onSavePlan?: () => void
  onCopy?: () => void
  onRetry?: () => void
  onEdit?: () => void
  onRemember?: () => void
  onDistill?: () => void
  canDistill?: boolean
  distillBusy?: boolean
  distillActive?: boolean
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
      : []),
    ...(onDistill && canDistill
      ? [
          {
            label: t('message.distill'),
            icon: <FlaskConical className="h-3 w-3" />,
            onClick: onDistill,
            disabled: distillBusy,
            loading: distillActive
          }
        ]
      : [])
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start"
    >
      <div className="flex w-full flex-col items-start">
        <div
          className={cn(
            'w-full rounded-xl px-3.5 py-2.5',
            isError && 'bg-red-500/[0.08] border border-red-500/20'
          )}
        >
          {runOutcome && !isStreaming && <RunOutcomeBadge outcome={runOutcome} />}
          {interrupted && !runOutcome && (
            <div className="mb-1.5 text-[11px] text-amber-400/90">
              ⚠ {tc('status.interrupted')}
            </div>
          )}
          {hasTimeline ? (
            <TimelineView
              timeline={resolvedTimeline}
              fallbackText={content}
              isStreaming={isStreaming}
              isError={isError}
            />
          ) : isStreaming ? (
            <StreamingPlaceholder />
          ) : null}
        </div>

        <MessageActions actions={assistantActions} align="start" />

        {(showImplementPlan && onImplementPlan && content?.trim()) ||
        (showSavePlan && onSavePlan && content?.trim()) ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {showSavePlan && onSavePlan && content?.trim() && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5"
                onClick={onSavePlan}
              >
                <Save className="h-3.5 w-3.5" />
                {t('message.savePlan')}
              </Button>
            )}
            {showImplementPlan && onImplementPlan && content?.trim() && (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 border border-amber-500/20"
                onClick={onImplementPlan}
              >
                <Play className="h-3.5 w-3.5" />
                {t('message.implementPlan')}
              </Button>
            )}
          </div>
        ) : null}
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
    prev.showImplementPlan === next.showImplementPlan &&
    prev.showSavePlan === next.showSavePlan &&
    prev.canDistill === next.canDistill &&
    prev.distillBusy === next.distillBusy &&
    prev.distillActive === next.distillActive &&
    prev.onDistill === next.onDistill
  )
}

export const MemoMessageBubble = memo(MessageBubble, areMessageBubblePropsEqual)
