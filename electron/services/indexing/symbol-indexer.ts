export interface ParsedSymbol {
  name: string
  kind: string
  startLine: number
  endLine: number
  content: string
}

const SYMBOL_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: 'function', pattern: /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'class', pattern: /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'interface', pattern: /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'type', pattern: /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/ },
  { kind: 'variable', pattern: /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/ },
  { kind: 'method', pattern: /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*[:{]/ }
]

export async function parseSymbols(content: string, language: string): Promise<ParsedSymbol[]> {
  if (!['typescript', 'javascript'].includes(language)) return []

  const lines = content.split('\n')
  const symbols: ParsedSymbol[] = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//')) return

    for (const { kind, pattern } of SYMBOL_PATTERNS) {
      const match = trimmed.match(pattern)
      if (!match?.[1]) continue
      symbols.push({
        name: match[1],
        kind,
        startLine: index + 1,
        endLine: index + 1,
        content: trimmed.slice(0, 4000)
      })
      break
    }
  })

  return symbols
}
