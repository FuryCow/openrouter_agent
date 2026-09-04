import { createHash } from 'crypto'
import { isAbsolute, join, normalize, resolve } from 'path'
import { mkdirSync } from 'fs'

export function hashWorkspacePath(workspacePath: string): string {
  const normalized = workspacePath.replace(/\\/g, '/').toLowerCase()
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export function getWorkspaceIndexDir(userDataPath: string, workspacePath: string): string {
  const hash = hashWorkspacePath(workspacePath)
  const dir = join(userDataPath, 'index', hash)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getIndexDbPath(indexDir: string): string {
  return join(indexDir, 'index.db')
}

export function getVectorIndexPath(indexDir: string): string {
  return join(indexDir, 'vectors.hnsw')
}

export function resolveSearchRoot(workspacePath: string, root?: string): string {
  const workspace = normalize(resolve(workspacePath))
  if (!root?.trim()) return workspace
  const candidate = root.trim()
  if (isAbsolute(candidate)) return normalize(resolve(candidate))
  return normalize(join(workspace, candidate))
}
