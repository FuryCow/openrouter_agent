export function scorePath(path: string, query: string): number {
  const lowerPath = path.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const fileName = path.split(/[/\\]/).pop()?.toLowerCase() ?? ''

  if (fileName === lowerQuery) return 1000
  if (fileName.startsWith(lowerQuery)) return 800
  if (fileName.includes(lowerQuery)) return 600
  if (lowerPath.includes(lowerQuery)) return 400

  const parts = lowerQuery.split(/\s+/).filter(Boolean)
  if (parts.length > 1 && parts.every((part) => lowerPath.includes(part))) return 300
  return 0
}

export function scoreCommand(label: string, keywords: string[], query: string): number {
  const lowerQuery = query.toLowerCase()
  if (!lowerQuery) return 1

  const haystack = [label, ...keywords].join(' ').toLowerCase()
  if (label.toLowerCase() === lowerQuery) return 1000
  if (label.toLowerCase().startsWith(lowerQuery)) return 800
  if (haystack.includes(lowerQuery)) return 500

  const parts = lowerQuery.split(/\s+/).filter(Boolean)
  if (parts.every((part) => haystack.includes(part))) return 300
  return 0
}
