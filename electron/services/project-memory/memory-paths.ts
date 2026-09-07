import { join } from 'path'
import { mkdirSync } from 'fs'
import { hashWorkspacePath } from '../indexing/index-paths'

export function getWorkspaceMemoryDir(userDataPath: string, workspacePath: string): string {
  const hash = hashWorkspacePath(workspacePath)
  const dir = join(userDataPath, 'memory', hash)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getMemoryJsonPath(userDataPath: string, workspacePath: string): string {
  return join(getWorkspaceMemoryDir(userDataPath, workspacePath), 'memory.json')
}
