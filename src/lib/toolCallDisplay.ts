export type ToolArgsView =
  | { kind: 'empty' }
  | { kind: 'paths'; paths: string[] }
  | { kind: 'file-path'; path: string }
  | {
      kind: 'search-replace'
      path: string
      oldString: string
      newString: string
      replaceAll?: boolean
    }
  | { kind: 'query'; query: string; meta: Array<{ label: string; value: string }> }
  | { kind: 'command'; command: string }
  | {
      kind: 'memory-update'
      action: string
      content?: string
      category?: string
      id?: string
    }
  | { kind: 'memory-read'; category?: string; query?: string }
  | { kind: 'generic'; fields: Array<{ key: string; value: string }> }

export type ToolResultView =
  | { kind: 'empty' }
  | { kind: 'message'; text: string; tone: 'default' | 'muted' | 'error' | 'success' }
  | { kind: 'file-sections'; sections: Array<{ path: string; content: string; error?: string }> }
  | { kind: 'grep-hits'; hits: Array<{ file: string; line: number; content: string }> }
  | {
      kind: 'search-hits'
      hits: Array<{
        path: string
        startLine: number
        endLine: number
        channel: string
        symbol?: string
        snippet: string
      }>
    }
  | { kind: 'dir-list'; entries: Array<{ name: string; isDirectory: boolean }> }
  | {
      kind: 'web-results'
      items: Array<{ title: string; url: string; snippet: string }>
    }
  | { kind: 'text'; text: string; tone: 'default' | 'muted' | 'error' }

export function parseToolArgsJson(argsJson: string): Record<string, unknown> | null {
  const trimmed = argsJson.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return String(value)
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item)).filter(Boolean)
}

function genericFields(args: Record<string, unknown>): ToolArgsView {
  const fields = Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    }))

  return fields.length > 0 ? { kind: 'generic', fields } : { kind: 'empty' }
}

export function buildToolArgsView(toolName: string, argsJson: string): ToolArgsView {
  const args = parseToolArgsJson(argsJson)
  if (!args) return argsJson.trim() ? genericFields({ raw: argsJson }) : { kind: 'empty' }

  switch (toolName) {
    case 'read_file':
    case 'write_file':
    case 'list_directory': {
      const path = asString(args.path)?.trim()
      return path ? { kind: 'file-path', path } : genericFields(args)
    }
    case 'read_files': {
      const paths = asStringArray(args.paths)
      return paths.length > 0 ? { kind: 'paths', paths } : genericFields(args)
    }
    case 'search_replace': {
      const path = asString(args.path)?.trim()
      const oldString = asString(args.old_string) ?? ''
      const newString = asString(args.new_string) ?? ''
      if (!path) return genericFields(args)
      return {
        kind: 'search-replace',
        path,
        oldString,
        newString,
        replaceAll: args.replace_all === true
      }
    }
    case 'grep_workspace':
    case 'search_files':
    case 'codebase_search':
    case 'web_search': {
      const query = asString(args.query)?.trim()
      if (!query) return genericFields(args)
      const meta: Array<{ label: string; value: string }> = []
      if (args.mode) meta.push({ label: 'mode', value: asString(args.mode) ?? '' })
      if (args.root) meta.push({ label: 'root', value: asString(args.root) ?? '' })
      if (args.path_glob) meta.push({ label: 'glob', value: asString(args.path_glob) ?? '' })
      if (args.limit !== undefined) meta.push({ label: 'limit', value: asString(args.limit) ?? '' })
      return { kind: 'query', query, meta: meta.filter((item) => item.value) }
    }
    case 'run_terminal': {
      const command = asString(args.command)?.trim()
      return command ? { kind: 'command', command } : genericFields(args)
    }
    case 'read_project_memory': {
      return {
        kind: 'memory-read',
        category: asString(args.category),
        query: asString(args.query)
      }
    }
    case 'update_project_memory': {
      return {
        kind: 'memory-update',
        action: asString(args.action) ?? 'append',
        content: asString(args.content),
        category: asString(args.category),
        id: asString(args.id)
      }
    }
    case 'get_open_files':
      return { kind: 'empty' }
    default:
      return genericFields(args)
  }
}

function parseFileSections(result: string): ToolResultView {
  if (!result.trim()) return { kind: 'empty' }

  const chunks = result.split(/\n(?=== )/g).filter(Boolean)
  if (chunks.length <= 1 && !result.startsWith('=== ')) {
    return { kind: 'text', text: result, tone: 'default' }
  }

  const sections = chunks.map((chunk) => {
    const match = chunk.match(/^=== (.+?) ===\n?([\s\S]*)$/)
    if (!match) return { path: 'file', content: chunk.trim() }
    const path = match[1].trim()
    const body = match[2] ?? ''
    if (body.startsWith('Error:')) {
      return { path, content: body, error: body.replace(/^Error:\s*/, '') }
    }
    return { path, content: body }
  })

  return { kind: 'file-sections', sections }
}

function parseGrepHits(result: string): ToolResultView | null {
  const lines = result.split('\n').filter(Boolean)
  if (lines.length === 0) return { kind: 'message', text: 'No matches found', tone: 'muted' }

  const hits = lines
    .map((line) => {
      const match = line.match(/^(.+?):(\d+):\s?(.*)$/)
      if (!match) return null
      return {
        file: match[1],
        line: Number(match[2]),
        content: match[3] ?? ''
      }
    })
    .filter((hit): hit is { file: string; line: number; content: string } => hit !== null)

  return hits.length > 0 ? { kind: 'grep-hits', hits } : null
}

function parseSearchHits(result: string): ToolResultView | null {
  const lines = result.split('\n').filter(Boolean)
  if (lines.length === 0) return { kind: 'message', text: 'No matches found', tone: 'muted' }

  const hits = lines
    .map((line) => {
      const match = line.match(
        /^(.+?):(\d+)-(\d+)\s+\[([^\]]+)\](?:\s+(\S+))?\s+(.*)$/
      )
      if (!match) return null
      return {
        path: match[1],
        startLine: Number(match[2]),
        endLine: Number(match[3]),
        channel: match[4],
        symbol: match[5] || undefined,
        snippet: match[6] ?? ''
      }
    })
    .filter(
      (
        hit
      ): hit is {
        path: string
        startLine: number
        endLine: number
        channel: string
        symbol?: string
        snippet: string
      } => hit !== null
    )

  return hits.length > 0 ? { kind: 'search-hits', hits } : null
}

function parseDirList(result: string): ToolResultView | null {
  const lines = result.split('\n').filter(Boolean)
  const entries = lines
    .map((line) => {
      const match = line.match(/^\[(dir|file)\]\s+(.+)$/)
      if (!match) return null
      return { isDirectory: match[1] === 'dir', name: match[2] }
    })
    .filter((entry): entry is { name: string; isDirectory: boolean } => entry !== null)

  return entries.length > 0 ? { kind: 'dir-list', entries } : null
}

function parseWebResults(result: string): ToolResultView | null {
  const blocks = result.split(/\n\n+/).filter(Boolean)
  const items = blocks
    .map((block) => {
      const lines = block.split('\n')
      const titleLine = lines[0] ?? ''
      const title = titleLine.replace(/^\*\*(.+)\*\*$/, '$1').trim()
      const url = lines[1]?.trim() ?? ''
      const snippet = lines.slice(2).join('\n').trim()
      if (!title || !url) return null
      return { title, url, snippet }
    })
    .filter((item): item is { title: string; url: string; snippet: string } => item !== null)

  return items.length > 0 ? { kind: 'web-results', items } : null
}

function messageTone(result: string): 'default' | 'muted' | 'error' | 'success' {
  if (result.startsWith('Error:')) return 'error'
  if (result.startsWith('Saved memory') || result.startsWith('Deleted memory')) return 'success'
  if (result === 'No matches found' || result === 'No files are currently open') return 'muted'
  return 'default'
}

export function buildToolResultView(toolName: string, result: string | undefined): ToolResultView {
  if (!result || result === 'null') return { kind: 'empty' }

  const tone = messageTone(result)
  if (tone === 'error' || tone === 'success' || tone === 'muted') {
    if (
      result === 'No matches found' ||
      result === 'No files are currently open' ||
      result.startsWith('Error:') ||
      result.startsWith('Saved memory') ||
      result.startsWith('Deleted memory')
    ) {
      return { kind: 'message', text: result, tone }
    }
  }

  switch (toolName) {
    case 'read_file':
    case 'read_files':
    case 'get_open_files':
      return parseFileSections(result)
    case 'grep_workspace':
    case 'search_files': {
      const parsed = parseGrepHits(result)
      return parsed ?? { kind: 'text', text: result, tone: 'default' }
    }
    case 'codebase_search': {
      const parsed = parseSearchHits(result)
      return parsed ?? { kind: 'text', text: result, tone: 'default' }
    }
    case 'list_directory': {
      const parsed = parseDirList(result)
      return parsed ?? { kind: 'text', text: result, tone: 'default' }
    }
    case 'web_search': {
      const parsed = parseWebResults(result)
      return parsed ?? { kind: 'text', text: result, tone: 'default' }
    }
    case 'run_terminal':
    case 'read_project_memory':
      return { kind: 'text', text: result, tone: result.startsWith('Error:') ? 'error' : 'default' }
    default:
      return { kind: 'text', text: result, tone: result.startsWith('Error:') ? 'error' : 'default' }
  }
}

export function truncateText(text: string, max = 4000): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n…`
}
