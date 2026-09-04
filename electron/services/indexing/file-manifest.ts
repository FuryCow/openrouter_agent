import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import XXHash from 'xxhash-wasm'
import type { ManifestEntry } from './index-types'
import {
  getLanguageFromExtension,
  shouldIgnoreDirName,
  shouldIgnoreRelativePath,
  shouldSkipFile,
  relativePathFromRoot
} from './ignore-rules'

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

export async function scanWorkspaceManifest(
  root: string,
  maxFileSizeBytes: number
): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = []

  async function walk(dir: string): Promise<void> {
    let names: string[]
    try {
      names = await readdir(dir)
    } catch {
      return
    }

    for (const name of names) {
      if (shouldIgnoreDirName(name)) continue
      const absolutePath = join(dir, name)
      const rel = relativePathFromRoot(root, absolutePath)
      if (shouldIgnoreRelativePath(rel)) continue

      try {
        const info = await stat(absolutePath)
        if (info.isDirectory()) {
          await walk(absolutePath)
          continue
        }
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
  }

  await walk(root)
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}
