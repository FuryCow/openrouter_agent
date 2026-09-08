import { describe, expect, it } from 'vitest'
import { getRelativePath, truncateMiddle, truncateRelativePath, isMarkdownPath, isImagePath } from './utils'

describe('isMarkdownPath', () => {
  it('detects markdown file extensions', () => {
    expect(isMarkdownPath('README.md')).toBe(true)
    expect(isMarkdownPath('page.MDX')).toBe(true)
    expect(isMarkdownPath('notes.markdown')).toBe(true)
    expect(isMarkdownPath('App.tsx')).toBe(false)
  })
})

describe('isImagePath', () => {
  it('detects common image file extensions', () => {
    expect(isImagePath('assets/logo.png')).toBe(true)
    expect(isImagePath('photo.JPG')).toBe(true)
    expect(isImagePath('icon.svg')).toBe(true)
    expect(isImagePath('App.tsx')).toBe(false)
  })
})

describe('getRelativePath', () => {
  it('returns path relative to workspace root', () => {
    expect(getRelativePath('C:/project', 'C:/project/src/App.tsx')).toBe('src/App.tsx')
    expect(getRelativePath('C:\\project\\', 'C:\\project\\src\\App.tsx')).toBe('src/App.tsx')
  })

  it('falls back to basename outside workspace', () => {
    expect(getRelativePath('C:/project', 'D:/other/file.ts')).toBe('file.ts')
  })
})

describe('truncateRelativePath', () => {
  it('keeps short paths unchanged', () => {
    expect(truncateRelativePath('src/App.tsx', 40)).toBe('src/App.tsx')
  })

  it('preserves filename and shortens directories from the left', () => {
    expect(truncateRelativePath('src/components/editor/CodeEditor.tsx', 28)).toBe(
      '.../editor/CodeEditor.tsx'
    )
  })

  it('truncates very long filenames in the middle', () => {
    const longName = 'very-long-file-name-that-does-not-fit.tsx'
    expect(truncateRelativePath(longName, 20).length).toBeLessThanOrEqual(20)
    expect(truncateRelativePath(longName, 20)).toContain('...')
  })
})

describe('truncateMiddle', () => {
  it('inserts ellipsis in the middle', () => {
    expect(truncateMiddle('abcdefghij', 7)).toBe('ab...ij')
  })
})
