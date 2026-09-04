import { spawn } from 'child_process'
import type { SearchResult } from '../../types'
import { relativePathFromRoot } from './ignore-rules'

interface RipgrepMatch {
  type: 'match'
  data: {
    path: { text: string }
    lines: { text: string }
    line_number: number
  }
}

let rgPathPromise: Promise<string> | null = null

async function getRgPath(): Promise<string> {
  if (!rgPathPromise) {
    rgPathPromise = import('@vscode/ripgrep').then((module) => module.rgPath)
  }
  return rgPathPromise
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
  const rgPath = await getRgPath()

  return new Promise((resolve, reject) => {
    const args = [
      '--json',
      '--line-number',
      '--no-heading',
      '--max-count',
      String(limit),
      ...(options.pathGlob ? ['--glob', options.pathGlob] : []),
      '--glob',
      '!.git/*',
      '--glob',
      '!node_modules/*',
      '--glob',
      '!dist/*',
      '--glob',
      '!out/*',
      '--glob',
      '!release/*',
      '--glob',
      '!.next/*',
      '--glob',
      '!build/*',
      query,
      root
    ]

    const child = spawn(rgPath, args, { windowsHide: true })
    const results: SearchResult[] = []
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0 && code !== 1 && stderr) {
        reject(new Error(stderr.trim() || `ripgrep exited with code ${code}`))
        return
      }

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

      resolve(results)
    })
  })
}
