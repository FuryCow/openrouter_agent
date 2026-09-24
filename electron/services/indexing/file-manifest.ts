import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import XXHash from 'xxhash-wasm'
import type { ManifestEntry } from './index-types'
import { getLanguageFromExtension, shouldSkipFile } from './ignore-rules'
import { getWorkspaceFileSet, listWorkspaceFiles } from './workspace-files'

let hasherPromise: ReturnType<typeof XXHash> | null = null

async function getHasher(): Promise<Awaited<ReturnType<typeof XXHash>>> {
  if (!hasherPromise) hasherPromise = XXHash()
  return hasherPromise
}

export async function hashFileContent(content: Buffer): Promise<string> {
  const { h64Raw } = await getHasher()
  const bytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
  return h64Raw(bytes).toString(16).padStart(16, '0')
}

export async function manifestEntryForFile(
  root: string,
  relativePath: string,
  maxFileSizeBytes: number,
  listedFiles?: Set<string>
): Promise<ManifestEntry | null> {
  const rel = relativePath.replace(/\\/g, '/')
  const listed = listedFiles ?? await getWorkspaceFileSet(root)
  if (!listed.has(rel)) return null

  const absolutePath = join(root, rel)
  const name = rel.split('/').pop() ?? rel

  try {
    const info = await stat(absolutePath)
    if (!info.isFile()) return null
    if (shouldSkipFile(name, info.size, maxFileSizeBytes)) return null

    const buffer = await readFile(absolutePath)
    const hash = await hashFileContent(buffer)
    return {
      path: rel,
      absolutePath,
      hash,
      mtimeMs: info.mtimeMs,
      size: info.size,
      language: getLanguageFromExtension(name)
    }
  } catch {
    return null
  }
}

export async function scanWorkspaceManifest(
  root: string,
  maxFileSizeBytes: number
): Promise<ManifestEntry[]> {
  const relativePaths = await listWorkspaceFiles(root)
  const entries: ManifestEntry[] = []

  for (const rel of relativePaths) {
    const absolutePath = join(root, rel)
    const name = rel.split('/').pop() ?? rel

    try {
      const info = await stat(absolutePath)
      if (!info.isFile()) continue
      if (shouldSkipFile(name, info.size, maxFileSizeBytes)) continue

      const buffer = await readFile(absolutePath)
      const hash = await hashFileContent(buffer)
      entries.push({
        path: rel,
        absolutePath,
        hash,
        mtimeMs: info.mtimeMs,
        size: info.size,
        language: getLanguageFromExtension(name)
      })
    } catch {
      // skip unreadable files
    }
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path))
}
