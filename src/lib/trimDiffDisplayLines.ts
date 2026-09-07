import type { DiffDisplayLine } from '@/types'

const DIFF_CONTEXT_LINES = 4
const MAX_DIFF_LINES = 24
const MAX_DIFF_HUNKS = 2

type RawDiffLine = Exclude<DiffDisplayLine, { type: 'sep' }>

function isChangeLine(line: DiffDisplayLine): line is RawDiffLine {
  return line.type !== 'sep' && line.type !== 'ctx'
}

export function trimDiffDisplayLines(
  lines: DiffDisplayLine[],
  contextLines = DIFF_CONTEXT_LINES,
  maxLines = MAX_DIFF_LINES
): DiffDisplayLine[] {
  const rawLines = lines.filter((line): line is RawDiffLine => line.type !== 'sep')
  if (rawLines.length === 0) return lines

  const changeIndices = rawLines
    .map((line, index) => (isChangeLine(line) ? index : -1))
    .filter((index) => index >= 0)

  if (changeIndices.length === 0) {
    return rawLines.slice(0, maxLines)
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
    let end = Math.min(rawLines.length - 1, hunk.end + contextLines)

    if (end - start + 1 > maxLines) {
      start = Math.max(0, hunk.start - contextLines)
      end = Math.min(rawLines.length - 1, start + maxLines - 1)
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
    result.push(rawLines[index])
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
