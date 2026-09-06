import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
    rs: 'rust',
    go: 'go',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell'
  }
  return map[ext] || 'plaintext'
}

export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path
}

export function isMarkdownPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return ext === 'md' || ext === 'mdx' || ext === 'markdown'
}

export function normalizePathSeparators(path: string): string {
  return path.replace(/\\/g, '/')
}

export function getRelativePath(root: string, filePath: string): string {
  const rootOriginal = normalizePathSeparators(root).replace(/\/$/, '')
  const rootNorm = rootOriginal.toLowerCase()
  const fileOriginal = normalizePathSeparators(filePath)
  const fileNorm = fileOriginal.toLowerCase()

  if (fileNorm === rootNorm) {
    return getFileName(filePath)
  }

  const prefix = `${rootNorm}/`
  if (fileNorm.startsWith(prefix)) {
    return fileOriginal.slice(rootOriginal.length).replace(/^\//, '')
  }

  return getFileName(filePath)
}

export function truncateMiddle(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  if (maxLength <= 3) return text.slice(0, maxLength)

  const edge = Math.floor((maxLength - 3) / 2)
  return `${text.slice(0, edge)}...${text.slice(text.length - edge)}`
}

export function truncateRelativePath(path: string, maxLength: number): string {
  const normalized = normalizePathSeparators(path)
  if (normalized.length <= maxLength) return normalized

  const parts = normalized.split('/')
  const fileName = parts.pop() || normalized

  if (fileName.length >= maxLength - 3) {
    return truncateMiddle(normalized, maxLength)
  }

  const prefix = '.../'
  for (let start = 0; start < parts.length; start += 1) {
    const tail = parts.slice(start)
    const candidate = [...tail, fileName].join('/')
    const withEllipsis = start === 0 ? candidate : `${prefix}${candidate}`

    if (withEllipsis.length <= maxLength) {
      return withEllipsis
    }
  }

  return truncateMiddle(normalized, maxLength)
}
