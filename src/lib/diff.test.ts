import { describe, expect, it } from 'vitest'
import { simpleLineDiff } from './diff'

describe('simpleLineDiff', () => {
  it('marks unchanged lines as context', () => {
    expect(simpleLineDiff('a\nb', 'a\nb')).toBe('  a\n  b')
  })

  it('marks changed lines as del/add pairs', () => {
    expect(simpleLineDiff('a\nold\nc', 'a\nnew\nc')).toBe('  a\n- old\n+ new\n  c')
  })

  it('handles added lines at the end', () => {
    expect(simpleLineDiff('a', 'a\nb')).toBe('  a\n+ b')
  })

  it('handles removed lines at the end', () => {
    expect(simpleLineDiff('a\nb', 'a')).toBe('  a\n- b')
  })

  it('treats empty strings as a single empty line', () => {
    expect(simpleLineDiff('', '')).toBe('  ')
  })

  it('handles replacement of the whole text', () => {
    expect(simpleLineDiff('old', 'new')).toBe('- old\n+ new')
  })

  it('preserves empty lines inside text', () => {
    expect(simpleLineDiff('a\n\nb', 'a\n\nb')).toBe('  a\n  \n  b')
  })
})
