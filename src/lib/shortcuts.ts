import type { TFunction } from 'i18next'

export interface KeyboardShortcut {
  keys: string
  description: string
}

const SHORTCUT_KEYS = [
  'sendMessage',
  'newLine',
  'saveFile',
  'quickOpen',
  'settings',
  'terminal',
  'list'
] as const

const SHORTCUT_KEY_LABELS: Record<(typeof SHORTCUT_KEYS)[number], string> = {
  sendMessage: 'Enter',
  newLine: 'Shift + Enter',
  saveFile: 'Ctrl + S',
  quickOpen: 'Ctrl + P',
  settings: 'Ctrl + L',
  terminal: 'Ctrl + `',
  list: 'Ctrl + /'
}

export function getKeyboardShortcuts(t: TFunction<'layout'>): KeyboardShortcut[] {
  return SHORTCUT_KEYS.map((id) => ({
    keys: SHORTCUT_KEY_LABELS[id],
    description: t(`shortcuts.${id}`)
  }))
}
