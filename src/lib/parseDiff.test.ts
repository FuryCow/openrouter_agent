import { describe, expect, it } from 'vitest'
import { parseDiffText, parseToolFilePath, trimDiffContext } from './parseDiff'

describe('trimDiffContext', () => {
  it('returns the diff unchanged when there are no change lines', () => {
    const diff = '  unchanged\n  lines only'
    expect(trimDiffContext(diff)).toBe(diff)
  })

  it('keeps context around changes and collapses distant hunks', () => {
    const lines = [
      '- removed',
      '+ added',
      ...Array.from({ length: 20 }, (_, i) => `  ctx ${i + 1}`),
      '- old tail',
      '+ new tail'
    ]
    const trimmed = trimDiffContext(lines.join('\n'))
    const out = trimmed.split('\n')
    expect(out).toContain('- removed')
    expect(out).toContain('+ added')
    expect(out).toContain('- old tail')
    expect(out).toContain('+ new tail')
    expect(out.some((line) => line.startsWith('  ...'))).toBe(true)
    expect(out.length).toBeLessThan(lines.length)
  })

  it('caps the output at the max line budget', () => {
    const lines = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? `- old ${i}` : `+ new ${i}`))
    const trimmed = trimDiffContext(lines.join('\n'))
    expect(trimmed.split('\n').length).toBeLessThanOrEqual(24)
  })

  it('does not treat content lines starting with +/- inside text as changes', () => {
    // Only lines that literally start with "- " / "+ " count as changes.
    const diff = '  - not a change marker at line start'
    expect(trimDiffContext(diff)).toBe(diff)
  })
})

describe('parseDiffText', () => {
  it('returns an empty list for empty input', () => {
    expect(parseDiffText('')).toEqual([])
    expect(parseDiffText('   \n  ')).toEqual([])
  })

  it('parses add, delete, and context lines with line numbers', () => {
    const lines = parseDiffText('  keep\n- old line\n+ new line\n  keep too')
    expect(lines).toEqual([
      { type: 'ctx', content: 'keep', oldLine: 1, newLine: 1 },
      { type: 'del', content: 'old line', oldLine: 2 },
      { type: 'add', content: 'new line', newLine: 2 },
      { type: 'ctx', content: 'keep too', oldLine: 3, newLine: 3 }
    ])
  })

  it('converts separator markers into sep entries', () => {
    const lines = parseDiffText('  ...\n- a\n  ...')
    expect(lines[0]).toEqual({ type: 'sep', content: '···' })
    expect(lines[2]).toEqual({ type: 'sep', content: '···' })
  })

  it('strips the two-space prefix from context lines', () => {
    const lines = parseDiffText('  indented content')
    expect(lines[0]).toEqual({ type: 'ctx', content: 'indented content', oldLine: 1, newLine: 1 })
  })

  it('keeps raw content for lines without the two-space prefix', () => {
    const lines = parseDiffText('plain line')
    expect(lines[0]).toEqual({ type: 'ctx', content: 'plain line', oldLine: 1, newLine: 1 })
  })

  it('counts old and new line numbers independently across hunks', () => {
    const lines = parseDiffText('- one\n- two\n+ alpha\n+ beta')
    const dels = lines.filter((line) => line.type === 'del')
    const adds = lines.filter((line) => line.type === 'add')
    expect(dels.map((line) => line.oldLine)).toEqual([1, 2])
    expect(adds.map((line) => line.newLine)).toEqual([1, 2])
  })
})

describe('parseToolFilePath', () => {
  it('extracts the path from write_file arguments', () => {
    expect(parseToolFilePath('write_file', JSON.stringify({ path: 'src/app.ts' }))).toBe('src/app.ts')
  })

  it('extracts the path from search_replace arguments', () => {
    expect(parseToolFilePath('search_replace', JSON.stringify({ path: 'a/b.ts' }))).toBe('a/b.ts')
  })

  it('returns undefined for other tools', () => {
    expect(parseToolFilePath('read_file', JSON.stringify({ path: 'src/app.ts' }))).toBeUndefined()
  })

  it('returns undefined for invalid JSON', () => {
    expect(parseToolFilePath('write_file', 'not-json')).toBeUndefined()
  })

  it('returns undefined for blank or missing paths', () => {
    expect(parseToolFilePath('write_file', JSON.stringify({ path: '   ' }))).toBeUndefined()
    expect(parseToolFilePath('write_file', JSON.stringify({}))).toBeUndefined()
  })
})
