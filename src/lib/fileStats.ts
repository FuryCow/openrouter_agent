export function countLines(content: string): number {
  if (content.length === 0) return 1
  return content.split('\n').length
}

export function getContentSizeBytes(content: string): number {
  return new TextEncoder().encode(content).length
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatIndentLabel(insertSpaces: boolean, tabSize: number): string {
  return insertSpaces ? `Spaces: ${tabSize}` : `Tab Size: ${tabSize}`
}

export function formatLanguageLabel(language: string): string {
  const labels: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    markdown: 'Markdown',
    json: 'JSON',
    css: 'CSS',
    html: 'HTML',
    python: 'Python',
    rust: 'Rust',
    go: 'Go',
    yaml: 'YAML',
    xml: 'XML',
    sql: 'SQL',
    shell: 'Shell',
    plaintext: 'Plain Text'
  }
  return labels[language] || language
}
