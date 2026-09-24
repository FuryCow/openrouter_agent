import { runRipgrep } from './ripgrep'
import { indexExcludeGlobArgs, relativePathFromRoot } from './ignore-rules'

export interface ListWorkspaceFilesOptions {
  glob?: string
}

const FILE_SET_CACHE_MS = 30_000

let fileSetCache: { root: string; files: Set<string>; loadedAt: number } | null = null

export function invalidateWorkspaceFileCache(): void {
  fileSetCache = null
}

export async function getWorkspaceFileSet(root: string, force = false): Promise<Set<string>> {
  if (
    !force &&
    fileSetCache &&
    fileSetCache.root === root &&
    Date.now() - fileSetCache.loadedAt < FILE_SET_CACHE_MS
  ) {
    return fileSetCache.files
  }

  const files = await listWorkspaceFiles(root)
  const set = new Set(files.map((file) => file.replace(/\\/g, '/')))
  fileSetCache = { root, files: set, loadedAt: Date.now() }
  return set
}

export function filterWatcherPaths(
  paths: string[],
  listed: Set<string>,
  indexed: Set<string>
): string[] {
  const relevant: string[] = []
  for (const path of paths) {
    const rel = path.replace(/\\/g, '/')
    if (!rel || rel === '.') continue
    if (listed.has(rel) || indexed.has(rel)) relevant.push(rel)
  }
  return relevant
}

function watcherPathNeedsRefresh(path: string, listed: Set<string>, indexed: Set<string>): boolean {
  const rel = path.replace(/\\/g, '/')
  if (!rel || rel === '.') return false
  return !listed.has(rel) && !indexed.has(rel)
}

export async function resolveWatcherFileSet(
  root: string,
  paths: string[],
  indexed: Set<string>
): Promise<Set<string>> {
  let listed = await getWorkspaceFileSet(root)
  if (paths.some((path) => watcherPathNeedsRefresh(path, listed, indexed))) {
    invalidateWorkspaceFileCache()
    listed = await getWorkspaceFileSet(root, true)
  }
  return listed
}

export async function listWorkspaceFiles(
  root: string,
  options: ListWorkspaceFilesOptions = {}
): Promise<string[]> {
  const args = ['--files', '--hidden', '--no-require-git', ...indexExcludeGlobArgs()]
  if (options.glob) {
    args.push('--glob', options.glob)
  }
  args.push(root)

  const { stdout, stderr, code } = await runRipgrep(args)
  if (code !== 0 && code !== 1 && stderr) {
    throw new Error(stderr.trim() || `ripgrep --files exited with code ${code}`)
  }

  const files: string[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    files.push(relativePathFromRoot(root, trimmed))
  }
  return files
}

export async function isWorkspaceFileListed(root: string, relativePath: string): Promise<boolean> {
  const rel = relativePath.replace(/\\/g, '/')
  const listed = await getWorkspaceFileSet(root)
  return listed.has(rel)
}
