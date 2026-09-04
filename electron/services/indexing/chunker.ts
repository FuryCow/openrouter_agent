export interface TextChunk {
  startLine: number
  endLine: number
  content: string
  symbolName?: string
}

const WINDOW_LINES = 60
const OVERLAP_LINES = 15

export function chunkFileContent(content: string, symbolRanges?: Array<{ name: string; startLine: number; endLine: number }>): TextChunk[] {
  const lines = content.split('\n')
  if (lines.length === 0) return []

  if (symbolRanges && symbolRanges.length > 0) {
    const chunks: TextChunk[] = []
    for (const symbol of symbolRanges) {
      const start = Math.max(1, symbol.startLine)
      const end = Math.min(lines.length, symbol.endLine)
      if (end < start) continue
      chunks.push({
        startLine: start,
        endLine: end,
        content: lines.slice(start - 1, end).join('\n'),
        symbolName: symbol.name
      })
    }
    if (chunks.length > 0) return chunks
  }

  const chunks: TextChunk[] = []
  let start = 1
  while (start <= lines.length) {
    const end = Math.min(lines.length, start + WINDOW_LINES - 1)
    chunks.push({
      startLine: start,
      endLine: end,
      content: lines.slice(start - 1, end).join('\n')
    })
    if (end >= lines.length) break
    start = end - OVERLAP_LINES + 1
  }
  return chunks
}
