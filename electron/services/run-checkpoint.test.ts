import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RunCheckpoint } from './run-checkpoint'
import { FileSystemService } from './filesystem'

describe('RunCheckpoint', () => {
  it('restores modified files and deletes new files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-cp-'))
    const existing = join(dir, 'a.txt')
    const created = join(dir, 'b.txt')
    writeFileSync(existing, 'original')

    const fs = new FileSystemService()
    const checkpoint = new RunCheckpoint()

    await checkpoint.captureBeforeMutation(fs, existing)
    await checkpoint.captureBeforeMutation(fs, created)

    await fs.writeFile(existing, 'changed')
    await fs.writeFile(created, 'new file')

    const result = await checkpoint.restore(fs)
    expect(result.restored).toBe(1)
    expect(result.deleted).toBe(1)
    expect(readFileSync(existing, 'utf8')).toBe('original')
    expect(existsSync(created)).toBe(false)
  })

  it('returns pre-mutation content from checkpoint', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-cp-before-'))
    const existing = join(dir, 'a.txt')
    const created = join(dir, 'b.txt')
    writeFileSync(existing, 'before')

    const fs = new FileSystemService()
    const checkpoint = new RunCheckpoint()

    await checkpoint.captureBeforeMutation(fs, existing)
    await checkpoint.captureBeforeMutation(fs, created)
    await fs.writeFile(existing, 'after')

    expect(checkpoint.getBeforeContent(existing)).toBe('before')
    expect(checkpoint.getBeforeContent(created)).toBe('')
    expect(checkpoint.getBeforeContent(join(dir, 'missing.txt'))).toBeUndefined()
  })

  it('reverts a file to the version from before the run, even after a second edit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-cp-twice-'))
    const file = join(dir, 'Camera.ts')
    writeFileSync(file, 'original focus')

    const fs = new FileSystemService()
    const checkpoint = new RunCheckpoint()

    await checkpoint.captureBeforeMutation(fs, file)
    await fs.writeFile(file, 'first edit')
    await checkpoint.captureBeforeMutation(fs, file)
    await fs.writeFile(file, 'second edit')

    await checkpoint.restore(fs)
    expect(readFileSync(file, 'utf8')).toBe('original focus')
    expect(checkpoint.hasChanges()).toBe(false)
    expect(checkpoint.summary).toEqual({ paths: [], count: 0 })

    await fs.writeFile(file, 'after revert')
    await checkpoint.restore(fs)
    expect(readFileSync(file, 'utf8')).toBe('after revert')
  })

  it('reports no changes until a file is captured, and skips paths it never saw', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-cp-empty-'))
    const created = join(dir, 'new.txt')
    const fs = new FileSystemService()
    const checkpoint = new RunCheckpoint()

    expect(checkpoint.hasChanges()).toBe(false)
    expect(checkpoint.summary).toEqual({ paths: [], count: 0 })

    await checkpoint.captureBeforeMutation(fs, created)
    expect(checkpoint.hasChanges()).toBe(true)
    expect(checkpoint.summary).toEqual({ paths: [created], count: 1 })

    const missing = await checkpoint.restorePaths(fs, [join(dir, 'absent.txt')])
    expect(missing).toEqual({ restored: 0, deleted: 0 })
    expect(checkpoint.hasChanges()).toBe(true)

    const unused = await checkpoint.restore(fs)
    expect(unused).toEqual({ restored: 0, deleted: 0 })
    expect(existsSync(created)).toBe(false)
  })
})
