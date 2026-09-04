import { app } from 'electron'
import { join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import type { ChatMessage, ChatMode } from '../types'

function chatDir(): string {
  return join(app.getPath('userData'), 'chats')
}

function chatPath(mode: ChatMode): string {
  return join(chatDir(), `${mode}.json`)
}

export async function loadChatMessages(mode: ChatMode): Promise<ChatMessage[]> {
  try {
    const raw = await readFile(chatPath(mode), 'utf-8')
    const parsed = JSON.parse(raw) as ChatMessage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveChatMessages(mode: ChatMode, messages: ChatMessage[]): Promise<void> {
  await mkdir(chatDir(), { recursive: true })
  await writeFile(chatPath(mode), JSON.stringify(messages, null, 2), 'utf-8')
}
