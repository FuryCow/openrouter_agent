import { describe, expect, it } from 'vitest'
import { resolveSearchRoot } from './index-paths'

describe('resolveSearchRoot', () => {
  it('returns workspace when root is omitted', () => {
    expect(resolveSearchRoot('F:\\test')).toBe('F:\\test')
  })

  it('joins relative subdirectories', () => {
    expect(resolveSearchRoot('F:\\test', 'minigame')).toBe('F:\\test\\minigame')
  })

  it('does not double absolute paths', () => {
    expect(resolveSearchRoot('F:\\test', 'F:\\test')).toBe('F:\\test')
  })
})
