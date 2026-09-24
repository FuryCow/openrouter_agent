import { describe, expect, it } from 'vitest'
import { shouldSkipFile } from './ignore-rules'
import { hashFileContent, scanWorkspaceManifest } from './file-manifest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('ignore-rules', () => {
  it('skips lockfiles and huge files', () => {
    expect(shouldSkipFile('package-lock.json', 100, 1024)).toBe(true)
    expect(shouldSkipFile('app.ts', 2_000_000, 1024)).toBe(true)
    expect(shouldSkipFile('app.ts', 100, 1024)).toBe(false)
  })
})

describe('file-manifest', () => {
  it('hashes buffers and scans via gitignore-aware file list', async () => {
    const hash = await hashFileContent(Buffer.from('hello'))
    expect(hash).toMatch(/^[0-9a-f]{16}$/)

    const dir = mkdtempSync(join(tmpdir(), 'ora-manifest-'))
    writeFileSync(join(dir, '.gitignore'), 'Library/\n*.meta\n', 'utf-8')
    mkdirSync(join(dir, 'src'))
    mkdirSync(join(dir, 'Library'))
    writeFileSync(join(dir, 'src', 'app.ts'), 'export const x = 1\n', 'utf-8')
    writeFileSync(join(dir, 'src', 'app.ts.meta'), 'fileFormatVersion: 2', 'utf-8')
    writeFileSync(join(dir, 'Library', 'cache'), 'junk', 'utf-8')

    const manifest = await scanWorkspaceManifest(dir, 1024 * 1024)
    expect(manifest.map((entry) => entry.path)).toContain('src/app.ts')
    expect(manifest.map((entry) => entry.path)).not.toContain('src/app.ts.meta')
    expect(manifest.map((entry) => entry.path)).not.toContain('Library/cache')

    rmSync(dir, { recursive: true, force: true })
  })
})
