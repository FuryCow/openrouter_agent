export type DiffLineType = 'add' | 'del' | 'ctx' | 'sep'

export type DiffLine = {
  type: DiffLineType
  content: string
  oldLine?: number
  newLine?: number
}

const DIFF_CONTEXT_LINES = 3
const MAX_DIFF_LINES = 20

function isDiffChangeLine(line: string): boolean {
  return line.startsWith('+ ') || line.startsWith('- ')
}

export function trimDiffContext(diff: string, contextLines = DIFF_CONTEXT_LINES): string {
  const lines = diff.split('\n')
  if (lines.length === 0) return diff

  const changeIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isDiffChangeLine(lines[i])) changeIndices.push(i)
  }

  if (changeIndices.length === 0) return diff

  const keep = new Set<number>()
  for (const idx of changeIndices) {
    const start = Math.max(0, idx - contextLines)
    const end = Math.min(lines.length - 1, idx + contextLines)
    for (let i = start; i <= end; i++) keep.add(i)
  }

  const sorted = [...keep].sort((a, b) => a - b)
  const result: string[] = []
  let prev = -2

  for (const idx of sorted) {
    if (prev >= 0 && idx > prev + 1) {
      result.push('  ...')
    }
    result.push(lines[idx])
    prev = idx
  }

  if (result.length > MAX_DIFF_LINES) {
    return [...result.slice(0, MAX_DIFF_LINES - 1), '  ...'].join('\n')
  }

  return result.join('\n')
}

export function parseDiffText(diff: string): DiffLine[] {
  const trimmed = trimDiffContext(diff)
  if (!trimmed.trim()) return []

  let oldLine = 1
  let newLine = 1
  const lines: DiffLine[] = []

  for (const line of trimmed.split('\n')) {
    const content = line.startsWith('  ') ? line.slice(2) : line
    if (content === '...') {
      lines.push({ type: 'sep', content: '···' })
      continue
    }

    if (line.startsWith('+ ')) {
      lines.push({ type: 'add', content: line.slice(2), newLine })
      newLine++
      continue
    }
    if (line.startsWith('- ')) {
      lines.push({ type: 'del', content: line.slice(2), oldLine })
      oldLine++
      continue
    }

    lines.push({ type: 'ctx', content, oldLine, newLine })
    oldLine++
    newLine++
  }

  return lines
}

export function parseToolFilePath(toolName: string, argsJson: string): string | undefined {
  try {
    const args = JSON.parse(argsJson) as { path?: string }
    if (toolName === 'write_file' || toolName === 'search_replace') {
      return args.path?.trim() || undefined
    }
  } catch {
    return undefined
  }
  return undefined
}
