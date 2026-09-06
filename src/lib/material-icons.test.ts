import { describe, expect, it } from 'vitest'
import { resolveFileIconKey, resolveFolderIconKey } from './material-icons'

describe('resolveFileIconKey', () => {
  it('maps typescript files', () => {
    expect(resolveFileIconKey('App.tsx')).toBe('react_ts')
    expect(resolveFileIconKey('utils.ts')).toBe('typescript')
  })

  it('maps package.json to nodejs icon', () => {
    expect(resolveFileIconKey('package.json')).toBe('nodejs')
  })

  it('falls back to generic file icon', () => {
    expect(resolveFileIconKey('unknown.xyzabc')).toBe('file')
  })
})

describe('resolveFolderIconKey', () => {
  it('maps src folder with open state', () => {
    expect(resolveFolderIconKey('src', false)).toBe('folder-src')
    expect(resolveFolderIconKey('src', true)).toBe('folder-src-open')
  })

  it('falls back to default folder icons', () => {
    expect(resolveFolderIconKey('random-folder', false)).toBe('folder')
    expect(resolveFolderIconKey('random-folder', true)).toBe('folder-open')
  })
})
