import { describe, expect, it } from 'vitest'
import { scoreCommand, scorePath } from './commandPaletteSearch'

describe('scorePath', () => {
  it('ranks exact file name matches highest', () => {
    expect(scorePath('src/app.ts', 'app.ts')).toBe(1000)
  })

  it('ranks prefix matches above substring matches', () => {
    expect(scorePath('src/app.ts', 'app')).toBe(800)
    expect(scorePath('src/myapp.ts', 'app')).toBe(600)
  })

  it('ranks path substring matches', () => {
    expect(scorePath('src/components/button.tsx', 'components')).toBe(400)
  })

  it('scores multi-word queries only when all parts match the path', () => {
    expect(scorePath('src/components/button.tsx', 'src button')).toBe(300)
    expect(scorePath('src/components/button.tsx', 'src missing')).toBe(0)
  })

  it('returns 0 when nothing matches', () => {
    expect(scorePath('src/app.ts', 'zzz')).toBe(0)
  })

  it('is case-insensitive and handles windows separators', () => {
    expect(scorePath('src\\App.ts', 'app.ts')).toBe(1000)
    expect(scorePath('SRC\\APP.TS', 'app')).toBe(800)
  })
})

describe('scoreCommand', () => {
  it('returns a minimal positive score for an empty query', () => {
    expect(scoreCommand('Settings', [], '')).toBe(1)
  })

  it('ranks exact label matches highest', () => {
    expect(scoreCommand('Settings', [], 'settings')).toBe(1000)
  })

  it('ranks label prefix above keyword substring', () => {
    expect(scoreCommand('Settings', ['preferences'], 'set')).toBe(800)
    expect(scoreCommand('Open Settings', ['preferences'], 'preferences')).toBe(500)
  })

  it('matches against keywords', () => {
    expect(scoreCommand('Terminal', ['show', 'hide'], 'hide')).toBe(500)
  })

  it('scores multi-word queries only when every word matches', () => {
    expect(scoreCommand('Toggle Terminal', ['show'], 'toggle show')).toBe(300)
    expect(scoreCommand('Toggle Terminal', ['show'], 'toggle missing')).toBe(0)
  })

  it('returns 0 when nothing matches', () => {
    expect(scoreCommand('Settings', [], 'zzz')).toBe(0)
  })
})
