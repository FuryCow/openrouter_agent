import type { TFunction } from 'i18next'
import type { ToolResultView } from './toolCallDisplay'

const PROTOCOL_RESULT_MESSAGES: Record<string, string> = {
  'No matches found': 'results.noMatches',
  'No files are currently open': 'results.noOpenFiles'
}

const PROTOCOL_RESULT_PREFIXES: Array<{ prefix: string; key: string }> = [
  { prefix: 'Saved memory', key: 'results.savedMemory' },
  { prefix: 'Deleted memory', key: 'results.deletedMemory' }
]

export function localizeToolResultText(text: string, t: TFunction<'tools'>): string {
  const exactKey = PROTOCOL_RESULT_MESSAGES[text]
  if (exactKey) return t(exactKey)

  for (const { prefix, key } of PROTOCOL_RESULT_PREFIXES) {
    if (text.startsWith(prefix)) {
      const rest = text.slice(prefix.length).trim()
      return rest ? `${t(key)} ${rest}` : t(key)
    }
  }

  if (text.startsWith('Error:')) {
    return `${t('results.errorPrefix')} ${text.slice('Error:'.length).trim()}`
  }

  return text
}

export function localizeToolResultView(view: ToolResultView, t: TFunction<'tools'>): ToolResultView {
  switch (view.kind) {
    case 'message':
      return { ...view, text: localizeToolResultText(view.text, t) }
    case 'text':
      return { ...view, text: localizeToolResultText(view.text, t) }
    default:
      return view
  }
}

export function localizeMetaLabel(label: string, t: TFunction<'common'>): string {
  const key = `meta.${label}` as const
  const translated = t(key)
  return translated === key ? label : translated
}
