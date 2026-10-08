import { describe, expect, it } from 'vitest'
import { formatCallToolResult } from './mcp-result-formatter'
import type { CallToolResult } from '@modelcontextprotocol/client'

const textBlock = (text: string) => ({ type: 'text' as const, text })

describe('formatCallToolResult', () => {
  it('prefixes error results with Error:', () => {
    const result = { isError: true, content: [textBlock('boom')] } as unknown as CallToolResult
    expect(formatCallToolResult(result)).toBe('Error: boom')
  })

  it('joins multiple text blocks with newlines', () => {
    const result = {
      content: [textBlock('first'), textBlock('second')]
    } as unknown as CallToolResult
    expect(formatCallToolResult(result)).toBe('first\nsecond')
  })

  it('prefers structuredContent over text content', () => {
    const result = {
      content: [textBlock('ignored')],
      structuredContent: { answer: 42 }
    } as unknown as CallToolResult
    expect(formatCallToolResult(result)).toBe('{\n  "answer": 42\n}')
  })

  it('falls back to String() when structuredContent is not JSON-serializable', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic['self'] = cyclic
    const result = { structuredContent: cyclic } as unknown as CallToolResult
    expect(formatCallToolResult(result)).toBe('[object Object]')
  })

  it('extracts text from embedded resource blocks', () => {
    const result = {
      content: [
        {
          type: 'resource',
          resource: { uri: 'file:///x.txt', text: 'resource body' }
        }
      ]
    } as unknown as CallToolResult
    expect(formatCallToolResult(result)).toBe('resource body')
  })

  it('serializes unknown block types as JSON', () => {
    const result = {
      content: [{ type: 'image', data: 'abc', mimeType: 'image/png' }]
    } as unknown as CallToolResult
    expect(formatCallToolResult(result)).toBe('{"type":"image","data":"abc","mimeType":"image/png"}')
  })

  it('reports success when there is no content at all', () => {
    const result = {} as CallToolResult
    expect(formatCallToolResult(result)).toBe('Tool completed successfully (no content returned)')
  })

  it('serializes empty text blocks as JSON (falsy text skips the text branch)', () => {
    const result = { content: [textBlock('')] } as unknown as CallToolResult
    expect(formatCallToolResult(result)).toBe('{"type":"text","text":""}')
  })
})
