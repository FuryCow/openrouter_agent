import { app } from 'electron'
import { join, dirname } from 'path'
import { mkdir, readFile, writeFile, access, rename } from 'fs/promises'
import { constants } from 'fs'
import type { ChatMessage, ChatMode } from '../types'
import { hashWorkspacePath } from './indexing/index-paths'

const MODES: ChatMode[] = ['agent', 'ask', 'planner']
const LEGACY_BUCKET = '_legacy'

function chatRoot(): string {
  return join(app.getPath('userData'), 'chats')
}

function workspaceChatDir(workspacePath: string): string {
  return join(chatRoot(), hashWorkspacePath(workspacePath))
}

function chatFilePath(workspacePath: string | null | undefined, mode: ChatMode): string {
  if (!workspacePath?.trim()) {
    return join(chatRoot(), LEGACY_BUCKET, `${mode}.json`)
  }
  return join(workspaceChatDir(workspacePath.trim()), `${mode}.json`)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function migrateLegacyGlobalChats(workspacePath: string): Promise<void> {
  const targetDir = workspaceChatDir(workspacePath)
  await mkdir(targetDir, { recursive: true })

  for (const mode of MODES) {
    const target = join(targetDir, `${mode}.json`)
    if (await fileExists(target)) continue

    const legacyGlobal = join(chatRoot(), `${mode}.json`)
    if (!(await fileExists(legacyGlobal))) continue

    const raw = await readFile(legacyGlobal, 'utf-8')
    await writeFile(target, raw, 'utf-8')

    const legacyBucketDir = join(chatRoot(), LEGACY_BUCKET)
    await mkdir(legacyBucketDir, { recursive: true })
    const legacyBucketPath = join(legacyBucketDir, `${mode}.json`)
    try {
      await rename(legacyGlobal, legacyBucketPath)
    } catch {
      // Ignore if already moved or locked
    }
  }
}

async function workspaceBucketIsEmpty(workspacePath: string): Promise<boolean> {
  for (const mode of MODES) {
    const target = join(workspaceChatDir(workspacePath), `${mode}.json`)
    if (!(await fileExists(target))) continue
    try {
      const existingRaw = await readFile(target, 'utf-8')
      const existing = JSON.parse(existingRaw) as unknown
      if (Array.isArray(existing) && existing.length > 0) return false
    } catch {
      return false
    }
  }
  return true
}

/** ponytail: _legacy is global — import once, never copy into every empty workspace */
async function migrateLegacyBucketOnce(workspacePath: string): Promise<void> {
  const markerPath = join(chatRoot(), LEGACY_BUCKET, '.migrated-to')
  if (await fileExists(markerPath)) return
  if (!(await workspaceBucketIsEmpty(workspacePath))) return

  const targetDir = workspaceChatDir(workspacePath)
  await mkdir(targetDir, { recursive: true })

  let imported = false
  for (const mode of MODES) {
    const legacyBucket = join(chatRoot(), LEGACY_BUCKET, `${mode}.json`)
    if (!(await fileExists(legacyBucket))) continue

    try {
      const raw = await readFile(legacyBucket, 'utf-8')
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || parsed.length === 0) continue
      await writeFile(join(targetDir, `${mode}.json`), raw, 'utf-8')
      imported = true
    } catch {
      // Ignore invalid legacy bucket files.
    }
  }

  if (imported) {
    await writeFile(markerPath, hashWorkspacePath(workspacePath), 'utf-8')
  }
}

export async function loadChatMessages(
  mode: ChatMode,
  workspacePath?: string | null
): Promise<ChatMessage[]> {
  const workspace = workspacePath?.trim() || null
  if (workspace) {
    await migrateLegacyGlobalChats(workspace)
    await migrateLegacyBucketOnce(workspace)
  }

  try {
    const raw = await readFile(chatFilePath(workspace, mode), 'utf-8')
    const parsed = JSON.parse(raw) as ChatMessage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveChatMessages(
  mode: ChatMode,
  messages: ChatMessage[],
  workspacePath?: string | null
): Promise<void> {
  const path = chatFilePath(workspacePath, mode)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(messages, null, 2), 'utf-8')
}
