import { describe, expect, it } from 'vitest'
import { detectEol, applyEol, eolAwareReplace } from './eol'

describe('detectEol', () => {
  it('detects CRLF when the first line break is preceded by CR', () => {
    expect(detectEol('a\r\nb\nc')).toBe('\r\n')
  })

  it('detects LF when the first line break is bare', () => {
    expect(detectEol('a\nb\r\nc')).toBe('\n')
  })

  it('defaults to LF for content without line breaks', () => {
    expect(detectEol('no breaks')).toBe('\n')
  })
})

describe('applyEol', () => {
  it('normalizes mixed line endings to CRLF', () => {
    expect(applyEol('a\nb\r\nc\r', '\r\n')).toBe('a\r\nb\r\nc\r')
  })

  it('normalizes mixed line endings to LF', () => {
    expect(applyEol('a\r\nb\nc', '\n')).toBe('a\nb\nc')
  })
})

describe('eolAwareReplace', () => {
  it('matches LF old_string in CRLF content and preserves CRLF', () => {
    const content = 'function a() {\r\n  return 1\r\n}\r\n'
    const result = eolAwareReplace(content, 'function a() {\n  return 1\n}', 'function a() {\n  return 2\n}')
    expect(result).toEqual({ status: 'ok', updated: 'function a() {\r\n  return 2\r\n}\r\n', replacements: 1 })
  })

  it('matches CRLF old_string in LF content and preserves LF', () => {
    const content = 'function a() {\n  return 1\n}\n'
    const result = eolAwareReplace(content, 'function a() {\r\n  return 1\r\n}', 'function a() {\r\n  return 2\r\n}')
    expect(result).toEqual({ status: 'ok', updated: 'function a() {\n  return 2\n}\n', replacements: 1 })
  })

  it('treats a bare CR before LF as a line break', () => {
    const result = eolAwareReplace('a\r\nb', 'a\nb', 'c')
    expect(result).toEqual({ status: 'ok', updated: 'c', replacements: 1 })
  })

  it('reports not_found when nothing matches', () => {
    expect(eolAwareReplace('abc', 'xyz', 'c')).toEqual({ status: 'not_found' })
  })

  it('reports ambiguous with the match count', () => {
    const result = eolAwareReplace('a\nb\na\nb', 'a\nb', 'c')
    expect(result).toEqual({ status: 'ambiguous', count: 2 })
  })

  it('replaces all occurrences with replace_all', () => {
    const result = eolAwareReplace('a\r\nb\r\na\r\nb', 'a\nb', 'c', true)
    expect(result).toEqual({ status: 'ok', updated: 'c\r\nc', replacements: 2 })
  })

  it('does not interpret regex metacharacters in old_string', () => {
    const result = eolAwareReplace('a.b\na.b', 'a.b', 'c', true)
    expect(result).toEqual({ status: 'ok', updated: 'c\nc', replacements: 2 })
  })

  it('does not interpret $ patterns in new_string', () => {
    const result = eolAwareReplace('x', 'x', '$&$1')
    expect(result).toEqual({ status: 'ok', updated: '$&$1', replacements: 1 })
  })

  it('keeps mixed-EOL content intact outside the replaced span', () => {
    const content = 'one\r\nkeep\r\nTARGET\nafter'
    const result = eolAwareReplace(content, 'TARGET', 'DONE')
    expect(result).toEqual({ status: 'ok', updated: 'one\r\nkeep\r\nDONE\nafter', replacements: 1 })
  })

  it('normalizes new_string line endings to the file style', () => {
    const result = eolAwareReplace('a\r\nb', 'a', 'x\ny')
    expect(result).toEqual({ status: 'ok', updated: 'x\r\ny\r\nb', replacements: 1 })
  })

  it('returns not_found for an empty old_string', () => {
    expect(eolAwareReplace('abc', '', 'c')).toEqual({ status: 'not_found' })
  })
})