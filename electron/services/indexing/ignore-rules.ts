import { basename, relative } from 'path'

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'release',
  '.next',
  'build',
  '.cursor'
])

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
  '.mp3',
  '.wasm'
])

export function getLanguageFromExtension(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.tsx')) return 'typescript'
  if (lower.endsWith('.ts')) return 'typescript'
  if (lower.endsWith('.jsx')) return 'javascript'
  if (lower.endsWith('.js')) return 'javascript'
  if (lower.endsWith('.py')) return 'python'
  if (lower.endsWith('.go')) return 'go'
  if (lower.endsWith('.rs')) return 'rust'
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.html')) return 'html'
  return 'text'
}

export function shouldIgnoreDirName(name: string): boolean {
  return name.startsWith('.') || IGNORED_DIRS.has(name)
}

export function shouldSkipFile(fileName: string, size: number, maxFileSizeBytes: number): boolean {
  if (LOCKFILES.has(fileName)) return true
  if (size > maxFileSizeBytes) return true
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : ''
  return BINARY_EXTENSIONS.has(ext)
}

export function shouldIgnoreRelativePath(relativePath: string): boolean {
  const parts = relativePath.replace(/\\/g, '/').split('/')
  return parts.some((part) => shouldIgnoreDirName(part))
}

export function relativePathFromRoot(root: string, absolutePath: string): string {
  return relative(root, absolutePath).replace(/\\/g, '/')
}
