import { describe, expect, it, vi } from 'vitest'
import { resolveErrorMessage } from './errorMessages'
import type { TFunction } from 'i18next'

function makeT(knownKeys: string[]): TFunction<'errors'> {
  const t = ((key: string, params?: Record<string, string>) => {
    if (!knownKeys.includes(key)) return key
    const suffix = params && Object.keys(params).length > 0 ? ` ${JSON.stringify(params)}` : ''
    return `localized:${key}${suffix}`
  }) as unknown as TFunction<'errors'>
  return t
}

describe('resolveErrorMessage', () => {
  it('localizes a known error code with params', () => {
    const t = makeT(['mcp.duplicateId'])
    expect(resolveErrorMessage('mcp.duplicateId', { id: 'x' }, 'fallback', t)).toBe(
      'localized:mcp.duplicateId {"id":"x"}'
    )
  })

  it('falls back when the code is unknown to the map', () => {
    const t = makeT([])
    expect(resolveErrorMessage('totally.unknown', undefined, 'fallback text', t)).toBe('fallback text')
  })

  it('falls back when the locale misses the key (t returns the key)', () => {
    const t = makeT([])
    expect(resolveErrorMessage('mcp.duplicateId', undefined, 'fallback text', t)).toBe('fallback text')
  })

  it('uses the generic requestFailed message when there is no fallback', () => {
    const t = makeT(['agent.requestFailed'])
    expect(resolveErrorMessage(undefined, undefined, undefined, t)).toBe('localized:agent.requestFailed')
  })

  it('prefers fallback over the generic message', () => {
    const t = makeT([])
    expect(resolveErrorMessage(undefined, undefined, 'raw error', t)).toBe('raw error')
  })

  it('passes empty params object when params are undefined', () => {
    const t = makeT(['terminal.emptyCommand'])
    const spy = vi.spyOn({ get: () => t }, 'get')
    void spy
    expect(resolveErrorMessage('terminal.emptyCommand', undefined, 'fb', t)).toBe(
      'localized:terminal.emptyCommand'
    )
  })
})
