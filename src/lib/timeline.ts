import type { ChatMessage, TimelineItem, ToolCallInfo } from '@/types'

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

export type TimelineSegment =
  | { kind: 'reasoning'; item: TimelineReasoningItem }
  | { kind: 'text'; item: TimelineTextItem }
  | { kind: 'tools'; id: string; items: TimelineToolItem[] }

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
    }
  }

  flushTools()
  return segments
}
