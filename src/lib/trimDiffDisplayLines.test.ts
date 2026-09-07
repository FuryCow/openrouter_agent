import { describe, expect, it } from 'vitest'
import { trimDiffDisplayLines } from './trimDiffDisplayLines'
import type { DiffDisplayLine } from '@/types'

function line(type: DiffDisplayLine['type'], content: string, newLine?: number): DiffDisplayLine {
  if (type === 'sep') return { type, content }
  return { type, content, newLine, oldLine: newLine }
}

describe('trimDiffDisplayLines', () => {
  it('keeps only a window around changes in large added files', () => {
    const lines = Array.from({ length: 40 }, (_, index) =>
      line('add', `line ${index + 1}`, index + 1)
    )

    const trimmed = trimDiffDisplayLines(lines)
    expect(trimmed.length).toBeLessThan(30)
  })

  it('preserves small localized hunks with context', () => {
    const lines: DiffDisplayLine[] = [
      ...Array.from({ length: 10 }, (_, index) => line('ctx', `ctx ${index + 1}`, index + 1)),
      line('del', 'old', 11),
      line('add', 'new', 11),
      ...Array.from({ length: 10 }, (_, index) => line('ctx', `tail ${index + 1}`, index + 12))
    ]

    const trimmed = trimDiffDisplayLines(lines)
    expect(trimmed.some((entry) => entry.type === 'del' && entry.content === 'old')).toBe(true)
    expect(trimmed.some((entry) => entry.type === 'add' && entry.content === 'new')).toBe(true)
    expect(trimmed.length).toBeLessThan(lines.length)
  })
})
