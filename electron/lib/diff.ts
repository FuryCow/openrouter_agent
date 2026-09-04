export interface DiffHighlightRange {
  startLine: number
  endLine: number
}

export interface DiffDisplayLine {
  type: 'add' | 'del' | 'ctx' | 'sep'
  content: string
  oldLine?: number
  newLine?: number
}

export interface FileDiffPreview {
  lines: DiffDisplayLine[]
  scrollToLine: number
  highlightRanges: DiffHighlightRange[]
}

type RawDiffLine = Exclude<DiffDisplayLine, { type: 'sep' }>

const DIFF_CONTEXT_LINES = 3
const MAX_DIFF_LINES = 20

function computeLineDiff(oldLines: string[], newLines: string[]): RawDiffLine[] {
  const m = oldLines.length
  const n = newLines.length
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const stack: RawDiffLine[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: 'ctx', content: oldLines[i - 1], oldLine: i, newLine: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', content: newLines[j - 1], newLine: j })
      j--
    } else {
      stack.push({ type: 'del', content: oldLines[i - 1], oldLine: i })
      i--
    }
  }

  return stack.reverse()
}

function trimDiffLines(
  lines: RawDiffLine[],
  contextLines = DIFF_CONTEXT_LINES,
  maxLines = MAX_DIFF_LINES
): DiffDisplayLine[] {
  const changeIndices = lines
    .map((line, index) => (line.type === 'ctx' ? -1 : index))
    .filter((index) => index >= 0)

  if (changeIndices.length === 0) {
    return lines
  }

  const keep = new Set<number>()
  for (const index of changeIndices) {
    const start = Math.max(0, index - contextLines)
    const end = Math.min(lines.length - 1, index + contextLines)
    for (let i = start; i <= end; i++) keep.add(i)
  }

  const sorted = [...keep].sort((a, b) => a - b)
  const result: DiffDisplayLine[] = []
  let prev = -2

  for (const index of sorted) {
    if (prev >= 0 && index > prev + 1) {
      result.push({ type: 'sep', content: '···' })
    }
    result.push(lines[index])
    prev = index
  }

  if (result.length > maxLines) {
    return [...result.slice(0, maxLines - 1), { type: 'sep', content: '···' }]
  }

  return result
}

function computeHighlightRanges(lines: RawDiffLine[]): DiffHighlightRange[] {
  const ranges: DiffHighlightRange[] = []
  let current: DiffHighlightRange | null = null

  for (const line of lines) {
    if (line.type !== 'add' || !line.newLine) continue

    if (!current) {
      current = { startLine: line.newLine, endLine: line.newLine }
      continue
    }

    if (line.newLine === current.endLine + 1) {
      current.endLine = line.newLine
      continue
    }

    ranges.push(current)
    current = { startLine: line.newLine, endLine: line.newLine }
  }

  if (current) ranges.push(current)
  return ranges
}

function computeScrollLine(lines: RawDiffLine[], highlightRanges: DiffHighlightRange[]): number {
  if (highlightRanges.length > 0) return highlightRanges[0].startLine

  for (let index = 0; index < lines.length; index++) {
    if (lines[index].type !== 'del') continue

    for (let next = index + 1; next < lines.length; next++) {
      if (lines[next].newLine) return lines[next].newLine
    }

    if (lines[index].oldLine) {
      return Math.max(1, lines[index].oldLine! - 1)
    }
  }

  return 1
}

export function buildFileDiffPreview(oldText: string, newText: string): FileDiffPreview {
  const fullLines = computeLineDiff(oldText.split('\n'), newText.split('\n'))
  const highlightRanges = computeHighlightRanges(fullLines)

  return {
    lines: trimDiffLines(fullLines),
    scrollToLine: computeScrollLine(fullLines, highlightRanges),
    highlightRanges
  }
}

function findLineNumber(content: string, search: string): number {
  if (!search) return 1
  const index = content.indexOf(search)
  if (index < 0) return 1
  return content.slice(0, index).split('\n').length
}

export function buildFallbackFileDiffPreview(
  oldText: string,
  newText: string,
  removed?: string,
  added?: string
): FileDiffPreview {
  if (oldText || newText) {
    return buildFileDiffPreview(oldText, newText)
  }

  const lines: RawDiffLine[] = []
  const startLine = removed ? findLineNumber(oldText, removed) : 1

  if (removed) {
    lines.push({ type: 'del', content: removed, oldLine: startLine })
  }
  if (added) {
    lines.push({ type: 'add', content: added, newLine: startLine })
  }

  const highlightRanges = computeHighlightRanges(lines)

  return {
    lines,
    scrollToLine: added ? startLine : computeScrollLine(lines, highlightRanges),
    highlightRanges
  }
}

/** @deprecated Legacy text diff for backwards compatibility */
export function simpleLineDiff(oldText: string, newText: string): string {
  return buildFileDiffPreview(oldText, newText)
    .lines.filter((line) => line.type !== 'sep')
    .map((line) => {
      if (line.type === 'add') return `+ ${line.content}`
      if (line.type === 'del') return `- ${line.content}`
      return `  ${line.content}`
    })
    .join('\n')
}

export function formatFileChangeDiff(oldText: string, newText: string): FileDiffPreview {
  return buildFileDiffPreview(oldText, newText)
}
