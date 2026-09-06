import { describe, expect, it } from 'vitest'
import { countLines, formatFileSize, formatIndentLabel, getContentSizeBytes } from './fileStats'

describe('fileStats', () => {
  it('counts lines', () => {
    expect(countLines('')).toBe(1)
    expect(countLines('a\nb\nc')).toBe(3)
  })

  it('formats file size', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(12_000)).toBe('12 KB')
  })

  it('formats indent label', () => {
    expect(formatIndentLabel(true, 2)).toBe('Spaces: 2')
    expect(formatIndentLabel(false, 4)).toBe('Tab Size: 4')
  })

  it('measures utf-8 byte size', () => {
    expect(getContentSizeBytes('abc')).toBe(3)
    expect(getContentSizeBytes('привет')).toBe(12)
  })
})
