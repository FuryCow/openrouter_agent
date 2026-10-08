import { describe, expect, it, vi } from 'vitest'
import { getKeyboardShortcuts } from './shortcuts'
import type { TFunction } from 'i18next'

describe('getKeyboardShortcuts', () => {
  it('returns all shortcuts with stable key labels and localized descriptions', () => {
    const t = vi.fn((key: string) => `desc:${key}`) as unknown as TFunction<'layout'>
    const shortcuts = getKeyboardShortcuts(t)

    expect(shortcuts.map((shortcut) => shortcut.keys)).toEqual([
      'Enter',
      'Shift + Enter',
      'Ctrl + S',
      'Ctrl + P',
      'Ctrl + L',
      'Ctrl + `',
      'Ctrl + Shift + `',
      'Ctrl + /'
    ])
    expect(shortcuts[0].description).toBe('desc:shortcuts.sendMessage')
    expect(t).toHaveBeenCalledTimes(8)
  })
})
