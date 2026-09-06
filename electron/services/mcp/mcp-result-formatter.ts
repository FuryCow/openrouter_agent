import type { CallToolResult } from '@modelcontextprotocol/client'

export function formatCallToolResult(result: CallToolResult): string {
  if (result.isError) {
    return `Error: ${extractTextContent(result)}`
  }

  if (result.structuredContent !== undefined) {
    try {
      return JSON.stringify(result.structuredContent, null, 2)
    } catch {
      return String(result.structuredContent)
    }
  }

  const text = extractTextContent(result)
  if (text) return text

  return 'Tool completed successfully (no content returned)'
}

function extractTextContent(result: CallToolResult): string {
  if (!result.content || result.content.length === 0) return ''

  const parts: string[] = []
  for (const block of result.content) {
    if (block.type === 'text' && block.text) {
      parts.push(block.text)
    } else if (block.type === 'resource' && 'resource' in block) {
      const resource = block.resource
      if (resource && typeof resource === 'object' && 'text' in resource) {
        parts.push(String((resource as { text?: string }).text ?? ''))
      }
    } else {
      try {
        parts.push(JSON.stringify(block))
      } catch {
        parts.push(String(block))
      }
    }
  }

  return parts.join('\n')
}
