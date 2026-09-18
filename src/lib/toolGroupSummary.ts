import type { TFunction } from 'i18next'
import type { ToolCallInfo } from '@/types'
import { getFileName } from '@/lib/utils'
import { parseToolFilePath } from '@/lib/parseDiff'
import type { TimelineToolItem } from '@/lib/timeline'

const FILE_CHANGE_TOOLS = new Set(['write_file', 'search_replace'])

export const TOOL_SUMMARY_COMPACT_MIN_COUNT = 3

export function resolveToolFilePath(toolCall: ToolCallInfo): string | undefined {
  if (toolCall.filePath) return toolCall.filePath
  if (FILE_CHANGE_TOOLS.has(toolCall.name)) {
    return parseToolFilePath(toolCall.name, toolCall.arguments)
  }
  return undefined
}

export type ToolSummarySegment =
  | { kind: 'single'; key: string; item: TimelineToolItem }
  | { kind: 'compact'; key: string; toolName: string; count: number; filePath?: string }

function groupKey(toolCall: ToolCallInfo): string {
  const filePath = resolveToolFilePath(toolCall)
  return filePath ? `${toolCall.name}:${filePath}` : toolCall.name
}

export function buildToolSummarySegments(
  tools: TimelineToolItem[],
  compactMinCount = TOOL_SUMMARY_COMPACT_MIN_COUNT
): ToolSummarySegment[] {
  const groups = new Map<string, TimelineToolItem[]>()

  for (const item of tools) {
    const key = groupKey(item.toolCall)
    const bucket = groups.get(key)
    if (bucket) bucket.push(item)
    else groups.set(key, [item])
  }

  const segments: ToolSummarySegment[] = []
  const seen = new Set<string>()

  for (const item of tools) {
    const key = groupKey(item.toolCall)
    if (seen.has(key)) continue
    seen.add(key)

    const group = groups.get(key)!
    if (group.length >= compactMinCount) {
      segments.push({
        kind: 'compact',
        key,
        toolName: item.toolCall.name,
        count: group.length,
        filePath: resolveToolFilePath(item.toolCall)
      })
      continue
    }

    for (const entry of group) {
      segments.push({ kind: 'single', key: entry.id, item: entry })
    }
  }

  return segments
}

export function formatCompactToolSummaryLabel(
  toolName: string,
  count: number,
  filePath: string | undefined,
  t: TFunction<'chat'>
): string {
  const shortName = t(`tool.shortNames.${toolName}`, { defaultValue: toolName })
  if (filePath) {
    return t('tool.compactFileCount', {
      name: shortName,
      file: getFileName(filePath),
      count
    })
  }
  return t('tool.compactCount', { name: shortName, count })
}
