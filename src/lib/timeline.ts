import type { ChatMessage, TimelineItem, ToolCallInfo } from '@/types'
import { resolveToolFilePath } from '@/lib/toolGroupSummary'

export function appendTimelineChunk(
  timeline: TimelineItem[],
  type: 'reasoning' | 'text',
  chunk: string
): TimelineItem[] {
  if (!chunk) return timeline

  const last = timeline[timeline.length - 1]
  if (last?.type === type) {
    return [...timeline.slice(0, -1), { ...last, content: last.content + chunk }]
  }

  return [...timeline, { id: `${type}-${Date.now()}-${Math.random()}`, type, content: chunk }]
}

export function upsertTimelineTool(
  timeline: TimelineItem[],
  toolCall: ToolCallInfo
): TimelineItem[] {
  const index = timeline.findIndex((item) => item.type === 'tool' && item.toolCall.id === toolCall.id)
  if (index === -1) {
    return [...timeline, { id: toolCall.id, type: 'tool', toolCall }]
  }

  const next = timeline.slice()
  next[index] = { id: toolCall.id, type: 'tool', toolCall }
  return next
}

export function resolveMessageTimeline(message: {
  timeline?: TimelineItem[]
  reasoning?: string
  toolCalls?: ToolCallInfo[]
  content?: string
}): TimelineItem[] {
  if (message.timeline?.length) return message.timeline

  const items: TimelineItem[] = []

  if (message.reasoning?.trim()) {
    items.push({
      id: 'reasoning-legacy',
      type: 'reasoning',
      content: message.reasoning.trim()
    })
  }

  message.toolCalls?.forEach((toolCall) => {
    items.push({ id: toolCall.id, type: 'tool', toolCall })
  })

  if (message.content?.trim()) {
    items.push({
      id: 'text-legacy',
      type: 'text',
      content: message.content.trim()
    })
  }

  return items
}

export function getFinalTextFromTimeline(timeline: TimelineItem[]): string {
  const textItems = timeline.filter((item) => item.type === 'text')
  return textItems[textItems.length - 1]?.type === 'text' ? textItems[textItems.length - 1].content : ''
}

export function timelineToLegacyFields(timeline: TimelineItem[]): {
  content: string
  reasoning?: string
  toolCalls?: ToolCallInfo[]
} {
  const reasoning = timeline
    .filter((item) => item.type === 'reasoning')
    .map((item) => item.content)
    .join('\n\n')
    .trim()

  const toolCalls = timeline
    .filter((item) => item.type === 'tool')
    .map((item) => item.toolCall)

  const content = getFinalTextFromTimeline(timeline)

  return {
    content,
    reasoning: reasoning || undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined
  }
}

export function mergeTimelineFromMessage(
  activeTimeline: TimelineItem[],
  message?: ChatMessage
): TimelineItem[] {
  if (message?.timeline?.length) return message.timeline
  if (activeTimeline.length > 0) return activeTimeline
  return resolveMessageTimeline(message ?? {})
}

export type TimelineToolItem = Extract<TimelineItem, { type: 'tool' }>
export type TimelineReasoningItem = Extract<TimelineItem, { type: 'reasoning' }>
export type TimelineTextItem = Extract<TimelineItem, { type: 'text' }>
export type TimelineToolGroupItem = Extract<TimelineItem, { type: 'tool-group' }>

export type TimelineSegment =
  | { kind: 'reasoning'; item: TimelineReasoningItem }
  | { kind: 'text'; item: TimelineTextItem }
  | { kind: 'tools'; id: string; items: TimelineToolItem[] }
  | { kind: 'tool-group'; item: TimelineToolGroupItem }

export function segmentTimeline(timeline: TimelineItem[]): TimelineSegment[] {
  const segments: TimelineSegment[] = []
  let toolBuffer: TimelineToolItem[] = []

  const flushTools = (): void => {
    if (toolBuffer.length === 0) return
    segments.push({
      kind: 'tools',
      id: `tools-${toolBuffer[0].id}-${toolBuffer[toolBuffer.length - 1].id}`,
      items: toolBuffer
    })
    toolBuffer = []
  }

  for (const item of timeline) {
    if (item.type === 'tool') {
      toolBuffer.push(item)
      continue
    }

    flushTools()
    if (item.type === 'reasoning') {
      segments.push({ kind: 'reasoning', item })
    } else if (item.type === 'text') {
      segments.push({ kind: 'text', item })
    } else if (item.type === 'tool-group') {
      segments.push({ kind: 'tool-group', item })
    }
  }

  flushTools()
  return segments
}

/**
 * Collapse runs of consecutive same-tool calls into one grouped item.
 * A run is keyed by tool name + resolved file path (file edits to the same
 * file group together, terminal calls group by name). Runs shorter than
 * minRunLength stay as individual items. Non-tool items break runs.
 */
export function groupTimelineTools(
  timeline: TimelineItem[],
  minRunLength = 3
): TimelineItem[] {
  const result: TimelineItem[] = []
  let run: TimelineToolItem[] = []

  const flushRun = (): void => {
    if (run.length === 0) return
    if (run.length >= minRunLength) {
      result.push({
        id: `tool-group-${run[0].id}-${run[run.length - 1].id}`,
        type: 'tool-group',
        toolName: run[0].toolCall.name,
        count: run.length,
        items: run
      })
    } else {
      for (const item of run) result.push(item)
    }
    run = []
  }

  for (const item of timeline) {
    if (item.type === 'tool') {
      const key = groupKeyForTool(item.toolCall)
      const prev = run[run.length - 1]
      if (prev && groupKeyForTool(prev.toolCall) === key) {
        run.push(item)
      } else {
        flushRun()
        run = [item]
      }
      continue
    }

    flushRun()
    result.push(item)
  }

  flushRun()
  return result
}

function groupKeyForTool(toolCall: ToolCallInfo): string {
  const filePath = resolveToolFilePath(toolCall)
  return filePath ? `${toolCall.name}:${filePath}` : toolCall.name
}

/**
 * Flatten a collapsed group's contents for its expanded body: unwrap
 * tool-group items into their member calls and keep everything else as-is.
 * Deliberately does NOT re-group — the members of a group share one group
 * key by construction, so re-grouping would collapse them back into the
 * very row the user just expanded (infinite "Search × 3" recursion).
 */
export function flattenActivityItems(items: TimelineItem[]): TimelineItem[] {
  return items.flatMap((item) => (item.type === 'tool-group' ? item.items : [item]))
}
