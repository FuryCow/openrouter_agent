import { describe, expect, it } from 'vitest'
import { compareVersions, isNewerVersion, parseVersion } from './update-checker'

describe('parseVersion', () => {
  it('parses release versions', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: [] })
  })

  it('parses alpha prerelease identifiers', () => {
    expect(parseVersion('1.0.0-alpha.7')).toEqual({ major: 1, minor: 0, patch: 0, pre: ['alpha', 7] })
  })

  it('parses rc prerelease identifiers', () => {
    expect(parseVersion('2.0.0-rc.1')).toEqual({ major: 2, minor: 0, patch: 0, pre: ['rc', 1] })
  })

  it('tolerates a leading v (GitHub tag style)', () => {
    expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: [] })
  })

  it('returns null for garbage', () => {
    expect(parseVersion('')).toBeNull()
    expect(parseVersion('not-a-version')).toBeNull()
    expect(parseVersion('1.2')).toBeNull()
    expect(parseVersion('1.2.3.4')).toBeNull()
  })
})

describe('compareVersions', () => {
  it('compares major/minor/patch', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('orders alpha increments', () => {
    expect(compareVersions('1.0.0-alpha.7', '1.0.0-alpha.6')).toBe(1)
    expect(compareVersions('1.0.0-alpha.6', '1.0.0-alpha.7')).toBe(-1)
    expect(compareVersions('1.0.0-alpha.7', '1.0.0-alpha.7')).toBe(0)
  })

  it('ranks a release above any prerelease of the same core', () => {
    expect(compareVersions('1.0.0', '1.0.0-alpha.9')).toBe(1)
    expect(compareVersions('1.0.0-alpha.9', '1.0.0')).toBe(-1)
  })

  it('ranks rc above alpha of the same core', () => {
    expect(compareVersions('1.0.0-rc.1', '1.0.0-alpha.9')).toBe(1)
  })

  it('compares numeric identifiers numerically, not lexically', () => {
    expect(compareVersions('1.0.0-alpha.10', '1.0.0-alpha.9')).toBe(1)
  })

  it('returns null when either version is unparseable', () => {
    expect(compareVersions('garbage', '1.0.0')).toBeNull()
    expect(compareVersions('1.0.0', 'garbage')).toBeNull()
  })
})

describe('isNewerVersion', () => {
  it('is true only for strictly newer versions', () => {
    expect(isNewerVersion('1.0.0-alpha.7', '1.0.0-alpha.6')).toBe(true)
    expect(isNewerVersion('1.0.0-alpha.7', '1.0.0-alpha.7')).toBe(false)
    expect(isNewerVersion('1.0.0-alpha.6', '1.0.0-alpha.7')).toBe(false)
    expect(isNewerVersion('1.0.0', '1.0.0-alpha.7')).toBe(true)
  })

  it('is false when either side is unparseable', () => {
    expect(isNewerVersion('garbage', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0-alpha.7', '')).toBe(false)
  })
})