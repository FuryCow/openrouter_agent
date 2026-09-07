import { describe, expect, it } from 'vitest'
import { buildFileDiffPreview } from './diff'

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
})
