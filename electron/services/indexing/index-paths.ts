import { createHash } from 'crypto'
import { isAbsolute, join, normalize, resolve, win32 } from 'path'
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
  const workspace = normalizeWorkspacePath(workspacePath)
  if (!root?.trim()) return workspace
  const candidate = root.trim()
  if (isAbsoluteSearchRoot(candidate)) return resolveAbsoluteSearchRoot(candidate)
  return joinSearchRoot(workspace, candidate)
}

function normalizeWorkspacePath(workspacePath: string): string {
  const trimmed = workspacePath.trim()
  if (win32.isAbsolute(trimmed) && !isAbsolute(trimmed)) {
    return win32.normalize(trimmed)
  }
  return normalize(resolve(trimmed))
}

function joinSearchRoot(workspace: string, candidate: string): string {
  if (win32.isAbsolute(workspace) && !isAbsolute(workspace)) {
    return win32.normalize(win32.join(workspace, candidate))
  }
  return normalize(join(workspace, candidate))
}

function isAbsoluteSearchRoot(candidate: string): boolean {
  return isAbsolute(candidate) || win32.isAbsolute(candidate)
}

function resolveAbsoluteSearchRoot(candidate: string): string {
  if (win32.isAbsolute(candidate) && !isAbsolute(candidate)) {
    return win32.normalize(candidate)
  }
  return normalize(resolve(candidate))
}
