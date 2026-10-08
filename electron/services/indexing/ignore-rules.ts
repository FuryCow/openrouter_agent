import { relative } from 'path'

export const INDEX_EXCLUDE_GLOBS = [
  '!**/node_modules/**',
  '!**/dist/**',
  '!**/out/**',
  '!**/release/**',
  '!**/.next/**',
  '!**/build/**',
  '!**/.cursor/**'
]

export function indexExcludeGlobArgs(): string[] {
  const args: string[] = []
  for (const glob of INDEX_EXCLUDE_GLOBS) args.push('--glob', glob)
  return args
}

export const LOCKFILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock'
])

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.wasm',
  '.mp3',
  '.ogg',
  '.wav',
  '.tif',
  '.tiff',
  '.psd'
])

export function getLanguageFromExtension(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.tsx')) return 'typescript'
  if (lower.endsWith('.ts')) return 'typescript'
  if (lower.endsWith('.jsx')) return 'javascript'
  if (lower.endsWith('.js')) return 'javascript'
  if (lower.endsWith('.cs')) return 'csharp'
  if (lower.endsWith('.py')) return 'python'
  if (lower.endsWith('.go')) return 'go'
  if (lower.endsWith('.rs')) return 'rust'
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.html')) return 'html'
  if (lower.endsWith('.shader')) return 'shader'
  if (lower.endsWith('.cginc')) return 'shader'
  if (lower.endsWith('.hlsl')) return 'shader'
  return 'text'
}

export function shouldSkipFile(fileName: string, size: number, maxFileSizeBytes: number): boolean {
  if (LOCKFILES.has(fileName)) return true
  if (size > maxFileSizeBytes) return true
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : ''
  return BINARY_EXTENSIONS.has(ext)
}

export function relativePathFromRoot(root: string, absolutePath: string): string {
  // Normalize separators before relativizing: path.relative is platform-specific,
  // so Windows-style inputs (C:\repo\...) must not be treated as POSIX segments on Linux CI.
  const normalizedRoot = root.replace(/\\/g, '/')
  const normalizedPath = absolutePath.replace(/\\/g, '/')
  return relative(normalizedRoot, normalizedPath).replace(/\\/g, '/')
}
