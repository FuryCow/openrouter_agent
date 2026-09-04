import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { FileSystemService } from './filesystem'

describe('FileSystemService', () => {
  let dir: string
  let fs: FileSystemService

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ora-fs-test-'))
    fs = new FileSystemService()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  describe('searchReplace', () => {
    it('replaces a unique match', async () => {
      const file = join(dir, 'a.txt')
      await writeFile(file, 'hello world', 'utf-8')
      const result = await fs.searchReplace(file, 'world', 'there')
      expect(result.replacements).toBe(1)
      expect(await fs.readFile(file)).toBe('hello there')
    })

    it('rejects ambiguous matches without replace_all', async () => {
      const file = join(dir, 'b.txt')
      await writeFile(file, 'foo foo', 'utf-8')
      await expect(fs.searchReplace(file, 'foo', 'bar')).rejects.toThrow(/matched 2 times/)
    })

    it('replaces all occurrences when replace_all is true', async () => {
      const file = join(dir, 'c.txt')
      await writeFile(file, 'x-x-x', 'utf-8')
      const result = await fs.searchReplace(file, 'x', 'y', true)
      expect(result.replacements).toBe(3)
      expect(await fs.readFile(file)).toBe('y-y-y')
    })

    it('rejects identical old and new strings', async () => {
      const file = join(dir, 'd.txt')
      await writeFile(file, 'same', 'utf-8')
      await expect(fs.searchReplace(file, 'same', 'same')).rejects.toThrow(/identical/)
    })
  })

  describe('readFiles', () => {
    it('returns content for existing files', async () => {
      const a = join(dir, 'a.txt')
      const b = join(dir, 'b.txt')
      await writeFile(a, 'A', 'utf-8')
      await writeFile(b, 'B', 'utf-8')
      const results = await fs.readFiles([a, b])
      expect(results).toEqual([
        { path: a, content: 'A' },
        { path: b, content: 'B' }
      ])
    })

    it('returns error entry for missing files without failing the batch', async () => {
      const existing = join(dir, 'exists.txt')
      const missing = join(dir, 'missing.txt')
      await writeFile(existing, 'ok', 'utf-8')
      const results = await fs.readFiles([existing, missing])
      expect(results[0]?.content).toBe('ok')
      expect(results[1]?.error).toBeTruthy()
    })
  })
})
