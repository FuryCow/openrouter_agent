import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppVersionMark } from '@/components/layout/AppVersionMark'
import { StatusBar } from '@/components/layout/StatusBar'
import { useAgent } from '@/hooks/useAgent'
import { respondToPendingApproval } from '@/lib/approvalResponse'
import { saveSuggestedMemories } from '@/lib/memorySuggestSave'
import { runMcpServerTest } from '@/lib/mcpServerTest'
import { saveAppSettings } from '@/lib/saveAppSettings'
import { useChatStore } from '@/stores/chatStore'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { getT } from '@/i18n/t'
import { ProjectMemoryService } from '../../electron/services/project-memory/project-memory-service'
import type { McpServerConfig } from '@/types'

vi.mock('@/hooks/useAppVersion', () => ({
  useAppVersion: () => '1.0.0-alpha.2'
}))

const plan = `# План

Цель
Починить камеру

Шаги
1. Открыть Camera.ts
2. Поправить фокус
`

const docs: McpServerConfig = {
  id: 'docs',
  name: 'Docs',
  enabled: true,
  transport: 'stdio',
  command: 'node'
}

describe('buttons in the window', () => {
  const send = vi.fn(async () => undefined)
  const abort = vi.fn(async () => undefined)
  const dirs: string[] = []

  beforeEach(() => {
    send.mockClear()
    abort.mockClear()
    useChatStore.setState({
      messages: [{ id: 'task', role: 'user', content: 'Починить камеру', mode: 'planner' }],
      isStreaming: false,
      chatMode: 'planner',
      pendingApproval: {
        id: 'approval-1',
        toolCallId: 'call-1',
        name: 'write_file',
        arguments: '{"path":"notes.txt"}',
        filePath: 'notes.txt'
      },
      pendingMemorySuggest: null,
      activeTimeline: []
    })
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        apiKey: 'sk-test',
        model: 'openai/gpt-4.1'
      },
      settingsOpen: true
    })
    useFileStore.setState({ workingDirectory: 'F:/camera' })
    useToastStore.setState({ toasts: [] })
    ;(globalThis as { window?: unknown }).window = {
      api: {
        agent: { send, abort }
      }
    }
  })

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('shows the version in the status bar and in settings', () => {
    const status = renderToStaticMarkup(createElement(StatusBar))
    const settings = renderToStaticMarkup(
      createElement(AppVersionMark, {
        version: '1.0.0-alpha.2',
        className: 'shrink-0 font-mono text-[11px] text-zinc-600'
      })
    )

    expect(status).toContain('v1.0.0-alpha.2')
    expect(status).toContain('font-mono text-[10px] text-zinc-600')
    expect(settings).toContain('v1.0.0-alpha.2')
    expect(settings).toContain('text-[11px]')
    expect(renderToStaticMarkup(createElement(AppVersionMark, { version: ' ' }))).toBe('')
  })

  it('sends the plan in agent mode when Implement plan is pressed', async () => {
    await useAgent().implementPlan(plan)

    expect(useChatStore.getState().chatMode).toBe('agent')
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
      getT('chat')('agent.implementingPlan')
    )
    expect(send).toHaveBeenCalledTimes(1)
    const [message, context] = send.mock.calls[0] as [
      string,
      { mode: string; approvedPlan: { steps: Array<{ text: string }> } }
    ]
    expect(message.startsWith('Original user task:\nПочинить камеру\n\n')).toBe(true)
    expect(message).toContain('Открыть Camera.ts')
    expect(context.mode).toBe('agent')
    expect(context.approvedPlan.steps.map((step) => step.text)).toEqual([
      'Открыть Camera.ts',
      'Поправить фокус'
    ])
  })

  it('does not send a plan while an answer is still streaming', async () => {
    useChatStore.setState({ isStreaming: true, chatMode: 'planner' })

    await useAgent().implementPlan(plan)

    expect(send).not.toHaveBeenCalled()
    expect(useChatStore.getState().chatMode).toBe('planner')
  })

  it('stops the answer only while one is streaming', () => {
    useAgent().abort()
    expect(abort).not.toHaveBeenCalled()

    useChatStore.setState({ isStreaming: true })
    useAgent().abort()
    expect(abort).toHaveBeenCalledTimes(1)
  })

  it('approves a write, rejects it, or allows it for the rest of the session', async () => {
    const approve = vi.fn(async () => undefined)
    const setSessionAutoApprove = vi.fn(async () => undefined)
    const pending = { id: 'approval-1', name: 'write_file' }

    await respondToPendingApproval({
      pending,
      approved: true,
      approve,
      setSessionAutoApprove
    })
    await respondToPendingApproval({
      pending,
      approved: false,
      approve,
      setSessionAutoApprove
    })
    await respondToPendingApproval({
      pending,
      approved: true,
      alwaysAllow: true,
      approve,
      setSessionAutoApprove
    })

    expect(approve.mock.calls).toEqual([
      ['approval-1', true],
      ['approval-1', false],
      ['approval-1', true]
    ])
    expect(setSessionAutoApprove).toHaveBeenCalledTimes(1)
    expect(setSessionAutoApprove).toHaveBeenCalledWith('write_file')

    const ignored = vi.fn(async () => undefined)
    await expect(
      respondToPendingApproval({
        pending: null,
        approved: true,
        approve: ignored,
        setSessionAutoApprove: ignored
      })
    ).resolves.toBe(false)
    expect(ignored).not.toHaveBeenCalled()
    await expect(
      respondToPendingApproval({
        pending,
        approved: true,
        approve,
        setSessionAutoApprove
      })
    ).resolves.toBe(true)
  })

  it('saves the selected memory and leaves the rest out of the project', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'memory-user-'))
    const workspace = mkdtempSync(join(tmpdir(), 'memory-work-'))
    dirs.push(userData, workspace)
    const service = new ProjectMemoryService(userData)

    const { saved } = await saveSuggestedMemories({
      entries: [
        { content: 'Camera focus lives in Camera.ts', category: 'note' },
        { content: 'Do not remember this', category: 'decision' }
      ],
      selectedIndexes: [0],
      workspace,
      remember: async (entry, folder) => {
        service.remember(folder, entry)
      }
    })

    expect(saved).toBe(1)
    const stored = service.listEntries(workspace).map((entry) => entry.content)
    expect(stored).toEqual(['Camera focus lives in Camera.ts'])
    expect(service.listEntries(workspace)[0]?.source).toBe('agent')

    const remember = vi.fn(async () => undefined)
    const skipped = await saveSuggestedMemories({
      entries: [{ content: 'later', category: 'note' }, { content: 'earlier', category: 'note' }],
      selectedIndexes: [1, 0, 9],
      workspace,
      remember
    })
    expect(skipped.saved).toBe(2)
    expect(remember.mock.calls.map((call) => call[0].content)).toEqual(['later', 'earlier'])
    expect(remember.mock.calls[0][0].source).toBe('agent')

    const untouched = vi.fn(async () => undefined)
    await expect(
      saveSuggestedMemories({
        entries: [{ content: 'no folder', category: 'note' }],
        selectedIndexes: [0],
        workspace: null,
        remember: untouched
      })
    ).resolves.toEqual({ saved: 0 })
    await expect(
      saveSuggestedMemories({
        entries: [{ content: 'nothing selected', category: 'note' }],
        selectedIndexes: [],
        workspace,
        remember: untouched
      })
    ).resolves.toEqual({ saved: 0 })
    expect(untouched).not.toHaveBeenCalled()
  })

  it('saves settings without reconnecting MCP', async () => {
    const calls: string[] = []
    const draft = {
      ...useSettingsStore.getState().settings,
      apiKey: 'sk-new',
      mcpServers: [docs]
    }

    await saveAppSettings({
      draft,
      save: async (next) => {
        calls.push('settings.save')
        expect(next.apiKey).toBe('sk-new')
        expect(next.mcpServers).toEqual([docs])
      },
      applyLocal: (next) => {
        calls.push('local')
        useSettingsStore.getState().setSettings(next)
      },
      reloadModels: async () => {
        calls.push('models')
      },
      close: () => {
        calls.push('close')
        useSettingsStore.getState().setSettingsOpen(false)
      }
    })

    expect(calls).toEqual(['settings.save', 'local', 'models', 'close'])
    expect(useSettingsStore.getState().settings.apiKey).toBe('sk-new')
    expect(useSettingsStore.getState().settingsOpen).toBe(false)
  })

  it('keeps settings open when save fails', async () => {
    const applyLocal = vi.fn()

    await expect(
      saveAppSettings({
        draft: useSettingsStore.getState().settings,
        save: async () => {
          throw new Error('Agent is still running')
        },
        applyLocal,
        reloadModels: async () => undefined,
        close: () => useSettingsStore.getState().setSettingsOpen(false)
      })
    ).rejects.toThrow('Agent is still running')

    expect(applyLocal).not.toHaveBeenCalled()
    expect(useSettingsStore.getState().settingsOpen).toBe(true)
  })

  it('tests one MCP server and does not open a connection when the command is missing', async () => {
    const t = getT('settings')
    const connect = vi.fn(async () => ({ ok: true, toolCount: 3 }))

    const ok = await runMcpServerTest(docs, connect, t)
    const broken = await runMcpServerTest(
      { id: 'broken', enabled: true, transport: 'stdio' },
      connect,
      t
    ).catch((err: unknown) => err)

    expect(ok).toEqual({ type: 'success', message: t('mcp.testSuccess', { count: 3 }) })
    const failed = await runMcpServerTest(
      docs,
      async () => ({ ok: false, toolCount: 0, error: 'connection refused' }),
      t
    )
    expect(failed).toEqual({ type: 'error', message: 'connection refused' })
    const unnamed = await runMcpServerTest(docs, async () => ({ ok: false, toolCount: 0 }), t)
    expect(unnamed).toEqual({ type: 'error', message: t('mcp.testFailed') })
    expect(broken).toMatchObject({ code: 'mcp.commandRequired' })
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledWith(docs)
  })
})
