import { describe, expect, it } from 'vitest'
import { localizeToolResultText } from './toolCallDisplayI18n'
import { i18n } from '../i18n'

describe('toolCallDisplayI18n', () => {
  it('localizes protocol result messages', () => {
    const t = i18n.getFixedT('en', 'tools')
    expect(localizeToolResultText('No matches found', t)).toBe('No matches found')
    expect(localizeToolResultText('No files are currently open', t)).toBe('No files are currently open')
  })
})
