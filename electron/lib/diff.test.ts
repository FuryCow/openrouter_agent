import { describe, expect, it } from 'vitest'
import { buildFileDiffPreview, buildInlineDiffRanges, buildInlineDeleteHighlights, buildDeletedLineHighlights, buildModifiedLineHighlights, countDiffStats } from './diff'

describe('buildFileDiffPreview', () => {
  it('trims large write_file diffs to a small window', () => {
    const oldText = ''
    const newText = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n')

    const preview = buildFileDiffPreview(oldText, newText)
    expect(preview.lines.length).toBeLessThan(35)
    expect(preview.lines.length).toBeGreaterThan(0)
  })

  it('keeps localized search_replace hunks with context', () => {
    const oldText = Array.from({ length: 30 }, (_, index) => `line ${index + 1}`).join('\n')
    const lines = oldText.split('\n')
    lines[14] = 'changed line'
    const newText = lines.join('\n')

    const preview = buildFileDiffPreview(oldText, newText)
    expect(preview.lines.some((line) => line.type === 'add' || line.type === 'del')).toBe(true)
    expect(preview.lines.length).toBeLessThan(20)
  })

  it('counts visible diff stats from inline and pure line changes', () => {
    const stats = countDiffStats('a\nb', 'a\nc\nd')
    expect(stats.additions).toBe(2)
    expect(stats.deletions).toBe(1)
  })

  it('builds inline ranges for changed lines', () => {
    const ranges = buildInlineDiffRanges('hello world', 'hello brave world')
    expect(ranges).toEqual([{ line: 1, startColumn: 7, endColumn: 13 }])
  })

  it('builds deleted line highlights for removed lines', () => {
    const deleted = buildDeletedLineHighlights('a\nb\nc', 'a\nc')
    expect(deleted).toEqual([{ afterLine: 1, content: 'b' }])
  })

  it('does not ghost entire replaced lines in deleted highlights', () => {
    const deleted = buildDeletedLineHighlights(
      '<title>Old</title>',
      '<title>Old & New</title>'
    )
    expect(deleted).toEqual([])
  })

  it('shows old content above modified lines', () => {
    const modified = buildModifiedLineHighlights(
      '<title>Old</title>',
      '<title>Old & New</title>'
    )
    expect(modified).toEqual([{ afterLine: 0, content: '<title>Old</title>' }])
  })

  it('does not inject inline delete text for modified lines', () => {
    const removed = buildInlineDeleteHighlights('hello old world', 'hello new world')
    expect(removed).toEqual([])
  })
})
