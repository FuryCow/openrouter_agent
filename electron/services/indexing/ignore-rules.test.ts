import { describe, expect, it } from 'vitest'
import {
  getLanguageFromExtension,
  indexExcludeGlobArgs,
  relativePathFromRoot,
  shouldSkipFile
} from './ignore-rules'

describe('indexExcludeGlobArgs', () => {
  it('expands each glob into --glob pairs', () => {
    const args = indexExcludeGlobArgs()
    expect(args.length).toBeGreaterThan(0)
    expect(args.length % 2).toBe(0)
    expect(args[0]).toBe('--glob')
    expect(args[1]).toBe('!**/node_modules/**')
    expect(args.filter((arg) => arg === '--glob').length).toBe(args.length / 2)
  })
})

describe('getLanguageFromExtension', () => {
  it('maps common extensions', () => {
    expect(getLanguageFromExtension('app.ts')).toBe('typescript')
    expect(getLanguageFromExtension('App.tsx')).toBe('typescript')
    expect(getLanguageFromExtension('index.js')).toBe('javascript')
    expect(getLanguageFromExtension('Comp.jsx')).toBe('javascript')
    expect(getLanguageFromExtension('Main.cs')).toBe('csharp')
    expect(getLanguageFromExtension('main.py')).toBe('python')
    expect(getLanguageFromExtension('main.go')).toBe('go')
    expect(getLanguageFromExtension('lib.rs')).toBe('rust')
    expect(getLanguageFromExtension('README.md')).toBe('markdown')
    expect(getLanguageFromExtension('package.json')).toBe('json')
    expect(getLanguageFromExtension('style.css')).toBe('css')
    expect(getLanguageFromExtension('page.html')).toBe('html')
    expect(getLanguageFromExtension('Frag.hlsl')).toBe('shader')
    expect(getLanguageFromExtension('Surf.shader')).toBe('shader')
    expect(getLanguageFromExtension('Inc.cginc')).toBe('shader')
  })

  it('is case-insensitive and falls back to text', () => {
    expect(getLanguageFromExtension('MAIN.TS')).toBe('typescript')
    expect(getLanguageFromExtension('data.csv')).toBe('text')
    expect(getLanguageFromExtension('Makefile')).toBe('text')
  })
})

describe('shouldSkipFile', () => {
  it('skips lockfiles regardless of size', () => {
    for (const name of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'poetry.lock']) {
      expect(shouldSkipFile(name, 0, 1024)).toBe(true)
    }
  })

  it('skips files above the size limit', () => {
    expect(shouldSkipFile('big.ts', 2048, 1024)).toBe(true)
    expect(shouldSkipFile('ok.ts', 1024, 1024)).toBe(false)
  })

  it('skips binary extensions', () => {
    expect(shouldSkipFile('logo.png', 10, 1024)).toBe(true)
    expect(shouldSkipFile('lib.dll', 10, 1024)).toBe(true)
    expect(shouldSkipFile('font.woff2', 10, 1024)).toBe(true)
    expect(shouldSkipFile('movie.mp4', 10, 1024)).toBe(true)
  })

  it('keeps text files', () => {
    expect(shouldSkipFile('app.ts', 10, 1024)).toBe(false)
    expect(shouldSkipFile('notes.md', 10, 1024)).toBe(false)
  })

  it('is case-insensitive on extensions', () => {
    expect(shouldSkipFile('LOGO.PNG', 10, 1024)).toBe(true)
  })

  it('treats dotfiles without extension as text', () => {
    expect(shouldSkipFile('.gitignore', 10, 1024)).toBe(false)
  })
})

describe('relativePathFromRoot', () => {
  it('normalizes backslashes to forward slashes', () => {
    expect(relativePathFromRoot('C:\\repo', 'C:\\repo\\src\\app.ts')).toBe('src/app.ts')
  })

  it('works with posix separators', () => {
    expect(relativePathFromRoot('/repo', '/repo/src/app.ts')).toBe('src/app.ts')
  })
})
