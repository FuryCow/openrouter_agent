import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  filterWatcherPaths,
  invalidateWorkspaceFileCache,
  isWorkspaceFileListed,
  listWorkspaceFiles,
  resolveWatcherFileSet
} from './workspace-files'

describe('workspace-files', () => {
  it('respects .gitignore patterns including globs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ora-ws-files-'))
    writeFileSync(
      join(dir, '.gitignore'),
      ['Library/', 'Temp/', '*.meta', 'node_modules/'].join('\n'),
      'utf-8'
    )
    mkdirSync(join(dir, 'Assets', 'Scripts'), { recursive: true })
    mkdirSync(join(dir, 'Library'))
    mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(dir, 'Assets', 'Scripts', 'Player.cs'), 'class Player {}', 'utf-8')
    writeFileSync(join(dir, 'Assets', 'Scripts', 'Player.cs.meta'), 'fileFormatVersion: 2', 'utf-8')
    writeFileSync(join(dir, 'Library', 'cache'), 'junk', 'utf-8')
    writeFileSync(join(dir, 'node_modules', 'pkg', 'index.js'), 'module.exports = {}', 'utf-8')

    const files = await listWorkspaceFiles(dir)
    expect(files).toContain('Assets/Scripts/Player.cs')
    expect(files).not.toContain('Assets/Scripts/Player.cs.meta')
    expect(files).not.toContain('Library/cache')
    expect(files).not.toContain('node_modules/pkg/index.js')

    expect(await isWorkspaceFileListed(dir, 'Assets/Scripts/Player.cs')).toBe(true)
    expect(await isWorkspaceFileListed(dir, 'Library/cache')).toBe(false)

    rmSync(dir, { recursive: true, force: true })
  })

  it('excludes default directories even without a gitignore', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ora-ws-globs-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true })
    mkdirSync(join(dir, '.openrouter', 'plans'), { recursive: true })
    writeFileSync(join(dir, 'src', 'app.ts'), 'export {}', 'utf-8')
    writeFileSync(join(dir, 'node_modules', 'pkg', 'index.js'), 'module.exports = {}', 'utf-8')
    writeFileSync(join(dir, '.openrouter', 'plans', 'note.md'), '# note', 'utf-8')

    const files = await listWorkspaceFiles(dir)
    expect(files).toContain('src/app.ts')
    expect(files).toContain('.openrouter/plans/note.md')
    expect(files).not.toContain('node_modules/pkg/index.js')

    rmSync(dir, { recursive: true, force: true })
  })

  it('refreshes the file cache when a watcher path is new', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ora-ws-cache-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'old.ts'), 'export {}', 'utf-8')
    invalidateWorkspaceFileCache()

    expect(await isWorkspaceFileListed(dir, 'src/old.ts')).toBe(true)
    writeFileSync(join(dir, 'src', 'new.ts'), 'export const n = 1', 'utf-8')
    expect(await isWorkspaceFileListed(dir, 'src/new.ts')).toBe(false)

    const listed = await resolveWatcherFileSet(dir, ['src/new.ts'], new Set())
    expect(listed.has('src/new.ts')).toBe(true)

    rmSync(dir, { recursive: true, force: true })
  })

  it('drops ignored watcher paths but keeps indexed deletions', () => {
    const listed = new Set(['Assets/Scripts/Player.cs'])
    const indexed = new Set(['Assets/Scripts/Old.cs'])
    expect(
      filterWatcherPaths(
        ['Library/cache', 'Assets/Scripts/Player.cs', 'Assets/Scripts/Old.cs'],
        listed,
        indexed
      )
    ).toEqual(['Assets/Scripts/Player.cs', 'Assets/Scripts/Old.cs'])
  })
})
