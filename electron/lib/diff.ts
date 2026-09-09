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

export interface InlineDiffRange {
  line: number
  startColumn: number
  endColumn: number
}

export interface DeletedLineHighlight {
  afterLine: number
  content: string
  markerLine?: number
}

export interface InlineDeleteHighlight {
  line: number
  removedText: string
  insertColumn: number
}

export interface RunCheckpointFileDetail {
  path: string
  additions: number
  deletions: number
  fileDiff: FileDiffPreview
  inlineRanges: InlineDiffRange[]
}

type RawDiffLine = Exclude<DiffDisplayLine, { type: 'sep' }>

const DIFF_CONTEXT_LINES = 4
const MAX_DIFF_LINES = 24
const MAX_DIFF_HUNKS = 2

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
    return lines.slice(0, maxLines)
  }

  const mergeGap = contextLines * 2 + 1
  const hunks: Array<{ start: number; end: number }> = []
  for (const index of changeIndices) {
    const last = hunks[hunks.length - 1]
    if (last && index - last.end <= mergeGap) {
      last.end = index
    } else {
      hunks.push({ start: index, end: index })
    }
  }

  const keep = new Set<number>()
  const visibleHunks = hunks.slice(0, MAX_DIFF_HUNKS)
  const hiddenHunks = hunks.length - visibleHunks.length

  for (const hunk of visibleHunks) {
    let start = Math.max(0, hunk.start - contextLines)
    let end = Math.min(lines.length - 1, hunk.end + contextLines)

    if (end - start + 1 > maxLines) {
      start = Math.max(0, hunk.start - contextLines)
      end = Math.min(lines.length - 1, start + maxLines - 1)
    }

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

  if (hiddenHunks > 0) {
    if (result.length > 0 && result[result.length - 1].type !== 'sep') {
      result.push({ type: 'sep', content: '···' })
    }
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

function extractAddedMiddle(
  oldLine: string,
  newLine: string,
  lineNumber: number
): InlineDiffRange | null {
  if (oldLine === newLine) return null

  let prefix = 0
  while (prefix < oldLine.length && prefix < newLine.length && oldLine[prefix] === newLine[prefix]) {
    prefix++
  }

  let suffix = 0
  while (
    suffix < oldLine.length - prefix &&
    suffix < newLine.length - prefix &&
    oldLine[oldLine.length - 1 - suffix] === newLine[newLine.length - 1 - suffix]
  ) {
    suffix++
  }

  const added = newLine.slice(prefix, newLine.length - suffix)
  if (!added) return null

  const startColumn = prefix + 1
  const endColumn = Math.max(startColumn + 1, newLine.length - suffix + 1)
  return { line: lineNumber, startColumn, endColumn }
}

export function buildInlineDiffRanges(oldText: string, newText: string): InlineDiffRange[] {
  const diffLines = computeLineDiff(oldText.split('\n'), newText.split('\n'))
  const ranges: InlineDiffRange[] = []

  for (let index = 0; index < diffLines.length; index++) {
    const line = diffLines[index]
    if (line.type !== 'del') continue

    const next = diffLines[index + 1]
    if (next?.type === 'add' && next.newLine) {
      const added = extractAddedMiddle(line.content, next.content, next.newLine)
      if (added) ranges.push(added)
    }
  }

  return ranges
}

export function buildInlineDeleteHighlights(
  _oldText: string,
  _newText: string
): InlineDeleteHighlight[] {
  return []
}

export function buildPureAdditionHighlightRanges(
  oldText: string,
  newText: string
): DiffHighlightRange[] {
  const diffLines = computeLineDiff(oldText.split('\n'), newText.split('\n'))
  const ranges: DiffHighlightRange[] = []
  let current: DiffHighlightRange | null = null

  for (let index = 0; index < diffLines.length; index++) {
    const line = diffLines[index]
    if (line.type !== 'add' || !line.newLine) continue
    if (index > 0 && diffLines[index - 1]?.type === 'del') continue

    if (!current) {
      current = { startLine: line.newLine, endLine: line.newLine }
      continue
    }

    if (line.newLine === current.endLine + 1) {
      current.endLine = line.newLine
    } else {
      ranges.push(current)
      current = { startLine: line.newLine, endLine: line.newLine }
    }
  }

  if (current) ranges.push(current)
  return ranges
}

export function buildDeletedLineHighlights(
  oldText: string,
  newText: string
): DeletedLineHighlight[] {
  const diffLines = computeLineDiff(oldText.split('\n'), newText.split('\n'))
  const highlights: DeletedLineHighlight[] = []

  for (let index = 0; index < diffLines.length; index++) {
    if (diffLines[index].type !== 'del') continue

    const delRun: RawDiffLine[] = []
    while (index < diffLines.length && diffLines[index].type === 'del') {
      delRun.push(diffLines[index])
      index++
    }

    let addCount = 0
    for (let j = index; j < diffLines.length && diffLines[j].type === 'add'; j++) {
      addCount++
    }

    if (addCount > 0) {
      index--
      continue
    }

    let afterLine = 0
    for (let k = index - delRun.length; k >= 0; k--) {
      const ctx = diffLines[k]
      if (ctx.type === 'ctx' && ctx.newLine !== undefined) {
        afterLine = ctx.newLine
        break
      }
    }

    for (const del of delRun) {
      highlights.push({ afterLine, content: del.content })
    }
    index--
  }

  return highlights
}

export function buildModifiedLineHighlights(
  oldText: string,
  newText: string
): DeletedLineHighlight[] {
  const diffLines = computeLineDiff(oldText.split('\n'), newText.split('\n'))
  const highlights: DeletedLineHighlight[] = []

  for (let index = 0; index < diffLines.length; index++) {
    if (diffLines[index].type !== 'del') continue

    const delRun: RawDiffLine[] = []
    while (index < diffLines.length && diffLines[index].type === 'del') {
      delRun.push(diffLines[index])
      index++
    }

    const addRun: RawDiffLine[] = []
    let addIndex = index
    while (addIndex < diffLines.length && diffLines[addIndex].type === 'add') {
      addRun.push(diffLines[addIndex])
      addIndex++
    }

    if (addRun.length === 0) {
      index--
      continue
    }

    const pairs = Math.min(delRun.length, addRun.length)
    for (let pair = 0; pair < pairs; pair++) {
      const addLine = addRun[pair]
      if (!addLine.newLine) continue
      highlights.push({
        afterLine: Math.max(0, addLine.newLine - 1),
        content: delRun[pair].content
      })
    }

    for (let pair = pairs; pair < delRun.length; pair++) {
      const anchor = addRun[pairs - 1]?.newLine ?? addRun[addRun.length - 1]?.newLine ?? 1
      highlights.push({
        afterLine: Math.max(0, anchor),
        content: delRun[pair].content
      })
    }

    index = addIndex - 1
  }

  return highlights
}

export function countDiffStats(oldText: string, newText: string): { additions: number; deletions: number } {
  const pureAddLines = buildPureAdditionHighlightRanges(oldText, newText)
  const additions =
    pureAddLines.reduce((sum, range) => sum + (range.endLine - range.startLine + 1), 0) +
    buildInlineDiffRanges(oldText, newText).length

  const deletions =
    buildDeletedLineHighlights(oldText, newText).length +
    buildModifiedLineHighlights(oldText, newText).length

  return { additions, deletions }
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
