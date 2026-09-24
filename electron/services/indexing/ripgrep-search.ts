import type { SearchResult } from '../../types'
import { runRipgrep } from './ripgrep'
import { indexExcludeGlobArgs, relativePathFromRoot } from './ignore-rules'

interface RipgrepMatch {
  type: 'match'
  data: {
    path: { text: string }
    lines: { text: string }
    line_number: number
  }
}

export interface RipgrepSearchOptions {
  limit?: number
  pathGlob?: string
}

export async function ripgrepSearch(
  query: string,
  root: string,
  limitOrOptions: number | RipgrepSearchOptions = 100
): Promise<SearchResult[]> {
  const options =
    typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions
  const limit = options.limit ?? 100

  const args = [
    '--json',
    '--line-number',
    '--no-heading',
    '--hidden',
    '--no-require-git',
    '--max-count',
    String(limit),
    ...(options.pathGlob ? ['--glob', options.pathGlob] : []),
    ...indexExcludeGlobArgs(),
    query,
    root
  ]

  const { stdout, stderr, code } = await runRipgrep(args)
  if (code !== 0 && code !== 1 && stderr) {
    throw new Error(stderr.trim() || `ripgrep exited with code ${code}`)
  }

  const results: SearchResult[] = []
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as RipgrepMatch
      if (event.type !== 'match') continue
      const filePath = event.data.path.text
      results.push({
        file: relativePathFromRoot(root, filePath),
        line: event.data.line_number,
        content: event.data.lines.text.trim().slice(0, 200)
      })
      if (results.length >= limit) break
    } catch {
      // skip malformed json lines
    }
  }

  return results
}
