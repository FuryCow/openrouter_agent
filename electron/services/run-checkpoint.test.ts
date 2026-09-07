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
})
