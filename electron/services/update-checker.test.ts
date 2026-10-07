import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  compareVersions,
  isNewerVersion,
  parseDigest,
  parseVersion,
  pickInstallerAsset,
  verifyInstallerFile,
  type UpdateAsset
} from './update-checker'

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

describe('pickInstallerAsset', () => {
  const asset = (name: string): UpdateAsset => ({ name, url: `https://x/${name}`, size: 1 })

  it('picks the NSIS Setup exe on Windows', () => {
    const assets = [
      asset('OpenRouter.Agent-1.0.0-alpha.7.AppImage'),
      asset('OpenRouter.Agent.Setup.1.0.0-alpha.7.exe'),
      asset('OpenRouter.Agent-1.0.0-alpha.7-arm64.dmg')
    ]
    expect(pickInstallerAsset(assets, 'win32', 'x64')?.name).toBe(
      'OpenRouter.Agent.Setup.1.0.0-alpha.7.exe'
    )
  })

  it('falls back to any exe on Windows when no Setup file exists', () => {
    expect(pickInstallerAsset([asset('app-portable.exe')], 'win32', 'x64')?.name).toBe(
      'app-portable.exe'
    )
  })

  it('picks the arm64 dmg on Apple Silicon', () => {
    const assets = [asset('app-1.0.0.dmg'), asset('app-1.0.0-arm64.dmg')]
    expect(pickInstallerAsset(assets, 'darwin', 'arm64')?.name).toBe('app-1.0.0-arm64.dmg')
  })

  it('picks the x64 dmg on Intel Macs', () => {
    const assets = [asset('app-1.0.0.dmg'), asset('app-1.0.0-arm64.dmg')]
    expect(pickInstallerAsset(assets, 'darwin', 'x64')?.name).toBe('app-1.0.0.dmg')
  })

  it('picks the AppImage on Linux', () => {
    const assets = [asset('app.exe'), asset('app-1.0.0.AppImage')]
    expect(pickInstallerAsset(assets, 'linux', 'x64')?.name).toBe('app-1.0.0.AppImage')
  })

  it('returns null for unsupported platforms or empty assets', () => {
    expect(pickInstallerAsset([], 'win32', 'x64')).toBeNull()
    expect(pickInstallerAsset([asset('app.exe')], 'freebsd', 'x64')).toBeNull()
  })
})

describe('parseDigest', () => {
  it('parses sha256 digests', () => {
    const hex = '9b23e0a891d64f35b75c8b881f59e7b5191c6ddd50cb22e62fffdbcf8fccc960'
    expect(parseDigest(`sha256:${hex}`)).toEqual({ algorithm: 'sha256', value: hex })
  })

  it('parses sha512 digests', () => {
    const hex = 'a'.repeat(128)
    expect(parseDigest(`sha512:${hex}`)).toEqual({ algorithm: 'sha512', value: hex })
  })

  it('lowercases the hex value', () => {
    expect(parseDigest(`sha256:${'AB'.repeat(32)}`)?.value).toBe('ab'.repeat(32))
  })

  it('rejects wrong lengths, unsupported algorithms, and garbage', () => {
    expect(parseDigest('sha256:abc')).toBeNull()
    expect(parseDigest(`sha256:${'a'.repeat(63)}`)).toBeNull()
    expect(parseDigest(`sha256:${'a'.repeat(65)}`)).toBeNull()
    expect(parseDigest(`md5:${'a'.repeat(32)}`)).toBeNull()
    expect(parseDigest('')).toBeNull()
    expect(parseDigest('garbage')).toBeNull()
  })
})

describe('verifyInstallerFile', () => {
  let dir: string
  const content = 'installer-bytes-0123456789'
  const contentDigest = `sha256:${createHash('sha256').update(content).digest('hex')}`

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'update-checker-test-'))
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const write = async (name: string, data: string): Promise<string> => {
    const filePath = join(dir, name)
    await writeFile(filePath, data)
    return filePath
  }

  it('accepts a file matching size and digest', async () => {
    const filePath = await write('ok.exe', content)
    await expect(
      verifyInstallerFile(filePath, { size: content.length, digest: contentDigest })
    ).resolves.toBeUndefined()
  })

  it('rejects a truncated file by size', async () => {
    const filePath = await write('truncated.exe', content.slice(0, 5))
    await expect(
      verifyInstallerFile(filePath, { size: content.length, digest: contentDigest })
    ).rejects.toThrow(/incomplete/)
  })

  it('rejects a corrupted file by digest', async () => {
    const filePath = await write('corrupt.exe', `${content}tampered`)
    await expect(
      verifyInstallerFile(filePath, { size: (content + 'tampered').length, digest: contentDigest })
    ).rejects.toThrow(/Checksum mismatch/)
  })

  it('skips the hash check when the asset has no digest', async () => {
    const filePath = await write('legacy.exe', content)
    await expect(
      verifyInstallerFile(filePath, { size: content.length })
    ).resolves.toBeUndefined()
  })

  it('skips the size check when the asset size is unknown', async () => {
    const filePath = await write('nosize.exe', content)
    await expect(
      verifyInstallerFile(filePath, { size: 0, digest: contentDigest })
    ).resolves.toBeUndefined()
  })
})