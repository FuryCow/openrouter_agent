import { describe, expect, it } from 'vitest'
import { shouldIgnoreRelativePath, shouldSkipFile } from './ignore-rules'
import { hashFileContent, scanWorkspaceManifest } from './file-manifest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('ignore-rules', () => {
  it('skips node_modules paths', () => {
    expect(shouldIgnoreRelativePath('src/index.ts')).toBe(false)
    expect(shouldIgnoreRelativePath('node_modules/pkg/index.js')).toBe(true)
  })

  it('skips lockfiles and huge files', () => {
    expect(shouldSkipFile('package-lock.json', 100, 1024)).toBe(true)
    expect(shouldSkipFile('app.ts', 2_000_000, 1024)).toBe(true)
    expect(shouldSkipFile('app.ts', 100, 1024)).toBe(false)
  })
})

describe('file-manifest', () => {
  it('hashes buffers for manifest scan', async () => {
    const hash = await hashFileContent(Buffer.from('hello'))
    expect(hash).toMatch(/^[0-9a-f]{16}$/)

    const dir = mkdtempSync(join(tmpdir(), 'ora-manifest-'))
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'src', 'app.ts'), 'export const x = 1\n', 'utf-8')
    const manifest = await scanWorkspaceManifest(dir, 1024 * 1024)
    expect(manifest).toHaveLength(1)
    expect(manifest[0].path).toBe('src/app.ts')
    rmSync(dir, { recursive: true, force: true })
  })
})