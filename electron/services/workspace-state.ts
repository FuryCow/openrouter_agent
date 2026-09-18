import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const GIT_TIMEOUT_MS = 3000
const MAX_DIRTY_FILES = 20

export interface WorkspaceStateSnapshot {
  isGitRepo: boolean
  branch?: string
  lastCommit?: string
  dirtyFiles: string[]
  formatted: string
}

function runGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return null
  }
}

function isGitRepository(workspacePath: string): boolean {
  if (runGit(workspacePath, ['rev-parse', '--is-inside-work-tree']) === 'true') {
    return true
  }
  const gitDir = join(workspacePath, '.git')
  return existsSync(gitDir)
}

function hasGitCommits(workspacePath: string): boolean {
  return runGit(workspacePath, ['rev-parse', '--verify', 'HEAD']) !== null
}

function formatWorkspaceState(snapshot: Omit<WorkspaceStateSnapshot, 'formatted'>): string {
  if (!snapshot.isGitRepo) {
    return 'Git: not a repository (or git unavailable).'
  }

  const lines: string[] = []
  lines.push(`Branch: ${snapshot.branch ?? 'unknown'}`)
  if (snapshot.lastCommit) {
    lines.push(`Last commit: ${snapshot.lastCommit}`)
  } else if (!snapshot.lastCommit && snapshot.branch) {
    lines.push('Last commit: none yet (empty repository)')
  }
  if (snapshot.dirtyFiles.length === 0) {
    lines.push('Working tree: clean')
  } else {
    lines.push(`Uncommitted changes (${snapshot.dirtyFiles.length}):`)
    for (const file of snapshot.dirtyFiles) {
      lines.push(`- ${file}`)
    }
    lines.push('Avoid unrelated edits; do not revert user work without asking.')
  }
  return lines.join('\n')
}

export function getWorkspaceState(workspacePath: string): WorkspaceStateSnapshot {
  if (!workspacePath?.trim()) {
    return {
      isGitRepo: false,
      dirtyFiles: [],
      formatted: 'Git: no workspace open.'
    }
  }

  if (!isGitRepository(workspacePath)) {
    const snapshot = { isGitRepo: false, dirtyFiles: [] as string[] }
    return { ...snapshot, formatted: formatWorkspaceState(snapshot) }
  }

  const hasCommits = hasGitCommits(workspacePath)
  const branch = hasCommits
    ? (runGit(workspacePath, ['rev-parse', '--abbrev-ref', 'HEAD']) ??
      runGit(workspacePath, ['branch', '--show-current']) ??
      undefined)
    : (runGit(workspacePath, ['symbolic-ref', '--short', 'HEAD']) ??
      runGit(workspacePath, ['branch', '--show-current']) ??
      undefined)

  const lastCommit = hasCommits
    ? (runGit(workspacePath, ['log', '-1', '--oneline']) ?? undefined)
    : undefined

  const statusRaw = runGit(workspacePath, ['status', '--porcelain'])
  const dirtyFiles: string[] = []
  if (statusRaw) {
    for (const line of statusRaw.split('\n')) {
      if (!line.trim()) continue
      const file = line.slice(3).trim()
      if (file) dirtyFiles.push(file)
      if (dirtyFiles.length >= MAX_DIRTY_FILES) break
    }
  }

  const snapshot = { isGitRepo: true, branch, lastCommit, dirtyFiles }
  return { ...snapshot, formatted: formatWorkspaceState(snapshot) }
}
