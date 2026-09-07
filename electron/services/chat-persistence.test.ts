import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('electron', () => ({
  app: {
    getPath: () => globalThis.__chatUserData as string
  }
}))

declare global {
  // eslint-disable-next-line no-var
  var __chatUserData: string
}

describe('chat-persistence', () => {
  beforeEach(async () => {
    globalThis.__chatUserData = mkdtempSync(join(tmpdir(), 'chat-persist-'))
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(globalThis.__chatUserData, { recursive: true, force: true })
  })

  it('stores chats per workspace hash', async () => {
    const { saveChatMessages, loadChatMessages } = await import('./chat-persistence')
    const workspace = join(tmpdir(), 'project-a')

    await saveChatMessages('agent', [{ id: '1', role: 'user', content: 'hi', mode: 'agent' }], workspace)
    const loaded = await loadChatMessages('agent', workspace)

    expect(loaded).toHaveLength(1)
    expect(loaded[0].content).toBe('hi')
  })

  it('migrates legacy global chats into the first workspace load', async () => {
    const { saveChatMessages, loadChatMessages } = await import('./chat-persistence')
    const chatRoot = join(globalThis.__chatUserData, 'chats')
    mkdirSync(chatRoot, { recursive: true })
    writeFileSync(
      join(chatRoot, 'agent.json'),
      JSON.stringify([{ id: 'legacy', role: 'user', content: 'old', mode: 'agent' }])
    )

    const workspace = join(tmpdir(), 'project-b')
    const loaded = await loadChatMessages('agent', workspace)

    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('legacy')
    expect(readFileSync(join(chatRoot, '_legacy', 'agent.json'), 'utf-8')).toContain('legacy')
  })
})
