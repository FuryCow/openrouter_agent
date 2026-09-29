import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentContext, AgentEvent, ChatMessage } from '../types'
import type { StreamResult, ToolCall } from './openrouter'

vi.mock('electron', () => ({
  app: {
    getPath: () => (globalThis as { __agentBehaviorUserData?: string }).__agentBehaviorUserData ?? ''
  }
}))

import { AgentService } from './agent'
import { FileSystemService } from './filesystem'
import type { CodebaseIndexer } from './indexing/codebase-indexer'
import type { McpManager } from './mcp/mcp-manager'
import type { ProjectMemoryService } from './project-memory/project-memory-service'
import type { TerminalService } from './terminal'
import type { WebSearchService } from './websearch'

type Step = StreamResult & {
  chunks?: string[]
  reasoningChunks?: string[]
  progress?: ToolCall
}

function call(name: string, args: Record<string, unknown>, id = name): ToolCall {
  return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } }
}

function reply(content: string, extra: Partial<Step> = {}): Step {
  return { content, reasoning: '', toolCalls: [], finishReason: 'stop', ...extra }
}

function tools(one: ToolCall): Step {
  return { content: '', reasoning: '', toolCalls: [one], finishReason: 'tool_calls' }
}

function toolOutput(events: AgentEvent[], name: string): string {
  const done = events.find(
    (event) => event.type === 'tool_done' && event.toolCall?.name === name
  )
  return done?.toolCall?.result ?? ''
}

describe('a full agent run', () => {
  const dirs: string[] = []
  let terminalCommand = ''
  let terminalThrows = false
  let memoryUpdate: { action?: string } | null = null
  let memoryThrows = false
  let mcpCalls: string[] = []
  let mcpNeedsApproval = false
  let hasApiKey = true
  let hangStream = false
  let hangAfter = -1
  let throwAfter = -1
  let seenMessages: Array<{ role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string; name?: string }> = []
  let seenTools: Array<{ function?: { name?: string } }> = []
  let seenCallOptions: { model?: string; temperature?: number; maxTokens?: number } = {}

  afterEach(() => {
    hasApiKey = true
    terminalThrows = false
    memoryThrows = false
    mcpNeedsApproval = false
    hangStream = false
    hangAfter = -1
    throwAfter = -1
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function workspace(): string {
    const userData = mkdtempSync(join(tmpdir(), 'agent-user-'))
    const dir = mkdtempSync(join(tmpdir(), 'agent-work-'))
    dirs.push(userData, dir)
    ;(globalThis as { __agentBehaviorUserData?: string }).__agentBehaviorUserData = userData
    return dir
  }

  function create(steps: Step[]): AgentService {
    let index = 0
    const model = {
      hasApiKey: () => hasApiKey,
      streamCompletion: async (
        messages: Array<{ role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string; name?: string }>,
        tools: Array<{ function?: { name?: string } }>,
        options: {
          onChunk?: (text: string) => void
          onReasoningChunk?: (text: string) => void
          onToolCallProgress?: (call: ToolCall) => void
          model?: string
          temperature?: number
          maxTokens?: number
        } = {}
      ) => {
        seenMessages = messages
        seenTools = tools
        seenCallOptions = {
          model: options.model,
          temperature: options.temperature,
          maxTokens: options.maxTokens
        }
        const callIndex = index
        if (throwAfter >= 0 && callIndex >= throwAfter) {
          throw new Error('network down')
        }
        if (hangStream || (hangAfter >= 0 && callIndex >= hangAfter)) {
          await new Promise<void>((_resolve, reject) => {
            const signal = (options as { signal?: AbortSignal }).signal
            signal?.addEventListener('abort', () => reject(new Error('aborted')))
          })
        }
        const step = steps[index]
        index += 1
        if (!step) throw new Error('model had no further reply')
        for (const chunk of step.chunks ?? []) options.onChunk?.(chunk)
        for (const chunk of step.reasoningChunks ?? []) options.onReasoningChunk?.(chunk)
        if (step.progress) options.onToolCallProgress?.(step.progress)
        return step
      }
    }
    const mcp = {
      getToolsForMode: () => [{ type: 'function', function: { name: 'mcp__docs__search' } }],
      getConnectedServerSummaries: () => [{ id: 'docs', name: 'Docs', toolCount: 1 }],
      isMcpTool: (name: string) => name.startsWith('mcp__'),
      requiresApproval: (name: string) => mcpNeedsApproval && name.includes('danger'),
      isToolAllowedInMode: (_name: string, mode: string) => mode !== 'ask',
      getServerName: (id: string) => id,
      callTool: async (name: string, args: Record<string, unknown>) => {
        mcpCalls.push(`${name}:${JSON.stringify(args)}`)
        return `mcp-ok ${name}`
      }
    }
    return new AgentService(
      model as never,
      new FileSystemService(),
      {
        runCommand: async (command: string) => {
          if (terminalThrows) throw new Error('shell missing')
          terminalCommand = command
          if (command === 'quiet') return ''
          if (command === 'loud') return 'Z'.repeat(5000)
          return 'pong'
        }
      } as TerminalService,
      {
        search: async (query: string) =>
          query
            ? [{ title: 'Docs', url: 'https://example.test', snippet: query }]
            : []
      } as WebSearchService,
      {
        search: async (input: { query?: string }) =>
          input.query === 'none'
            ? []
            : [
                {
                  path: 'src/Camera.ts',
                  startLine: 1,
                  endLine: 2,
                  channel: 'text',
                  snippet: 'focus',
                  symbolName: 'cameraFocus'
                }
              ]
      } as unknown as CodebaseIndexer,
      mcp as unknown as McpManager,
      {
        read: () => 'remembered focus',
        update: (_cwd: string, input: { action?: string; content?: string }) => {
          if (memoryThrows) throw new Error('memory locked')
          memoryUpdate = input
          if (input.action === 'delete') return null
          return { id: 'mem-1', category: input.action === 'update' ? 'decision' : 'note' }
        }
      } as unknown as ProjectMemoryService
    )
  }

  async function run(
    dir: string,
    steps: Step[],
    extra: Partial<AgentContext> = {},
    approve: boolean | 'deny' = true
  ): Promise<AgentEvent[]> {
    terminalCommand = ''
    memoryUpdate = null
    mcpCalls = []
    seenMessages = []
    seenTools = []
    seenCallOptions = {}
    const agent = create(steps)
    const events: AgentEvent[] = []
    await agent.run(
      'do the task',
      {
        mode: 'agent',
        workingDirectory: dir,
        openFiles: [],
        history: [],
        model: 'test-model',
        autoApproveWrites: true,
        autoApproveTerminal: true,
        ...extra
      },
      (event) => {
        events.push(event)
        if (event.type === 'approval_request' && event.approval && approve !== true) {
          queueMicrotask(() => agent.resolveApproval(event.approval!.id, approve === 'deny' ? false : true))
        } else if (event.type === 'approval_request' && event.approval) {
          queueMicrotask(() => agent.resolveApproval(event.approval!.id, true))
        }
      }
    )
    return events
  }

  it('refuses to start without a key, a folder, or a second run at once', async () => {
    const dir = workspace()
    hasApiKey = false
    const noKey = create([reply('nope')])
    const keyEvents: AgentEvent[] = []
    await noKey.run('hello', base(dir), (event) => keyEvents.push(event))
    expect(keyEvents.some((event) => event.type === 'error' && event.errorCode === 'openrouter.apiKeyMissing')).toBe(
      true
    )

    hasApiKey = true
    const noFolder = create([reply('nope')])
    const folderEvents: AgentEvent[] = []
    await noFolder.run('hello', { ...base(dir), workingDirectory: '' }, (event) => folderEvents.push(event))
    expect(folderEvents.some((event) => event.type === 'error' && event.errorCode === 'agent.noWorkspaceFolder')).toBe(
      true
    )

    const inside = create([reply('nope')])
    const insideEvents: AgentEvent[] = []
    await inside.run(
      'hello',
      { ...base(dir), workingDirectory: process.cwd() },
      (event) => insideEvents.push(event)
    )
    expect(insideEvents.some((event) => event.type === 'error' && event.errorCode === 'workspace.agentAppFolder')).toBe(
      true
    )

    hangStream = true
    const hanging = create([reply('never')])
    const firstEvents: AgentEvent[] = []
    const first = hanging.run('stay', base(dir), (event) => firstEvents.push(event))
    await vi.waitFor(() => {
      expect(firstEvents.some((event) => event.type === 'run_status')).toBe(true)
    })
    const secondEvents: AgentEvent[] = []
    await hanging.run('again', base(dir), (event) => secondEvents.push(event))
    expect(secondEvents.some((event) => event.type === 'error' && event.errorCode === 'agent.alreadyRunning')).toBe(
      true
    )
    hanging.abort()
    await first
    expect(hanging.isRunning).toBe(false)
  })

  it('shows streamed text, reasoning, and a tool that is still being prepared', async () => {
    const dir = workspace()
    const events = await run(dir, [
      reply('', {
        chunks: ['Hello'],
        reasoningChunks: ['thinking'],
        progress: call('', {})
      })
    ])
    const done = events.find((event) => event.type === 'done')
    expect(done?.message?.content).toContain('Hello')
    expect(events.some((event) => event.type === 'stream' && event.content === 'Hello')).toBe(true)
    expect(events.some((event) => event.type === 'reasoning_stream' && event.content === 'thinking')).toBe(true)
    expect(events.some((event) => event.type === 'tool_progress' && event.toolCall?.name === 'preparing')).toBe(
      true
    )
    expect(String(seenMessages[0]?.content)).toContain(dir)
  })

  it('reads, lists, searches, and answers from an attachment and an image', async () => {
    const dir = workspace()
    writeFileSync(join(dir, 'Camera.ts'), 'export const cameraFocus = 1\nexport const cameraFocus = 1\n')
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'src', 'only-here.ts'), 'uniqueZoomToken')
    const events = await run(
      dir,
      [
        tools(call('read_file', { path: 'Camera.ts' }, 'camera')),
        tools(call('read_file', { path: join(process.cwd(), 'package.json') }, 'app-file')),
        tools(call('read_files', { paths: ['Camera.ts', 'missing.ts'] })),
        tools(call('read_files', { paths: [] })),
        tools(call('read_files', { paths: Array.from({ length: 11 }, (_, i) => `f${i}.ts`) })),
        tools(call('list_directory', { path: '.' })),
        tools(call('list_directory', {}, 'list-root')),
        tools(call('search_files', { query: 'uniqueZoomToken', root: 'src' })),
        tools(call('search_files', { query: 'no-such-token' })),
        tools(call('grep_workspace', { query: 'cameraFocus', limit: 1, path_glob: 'Camera.ts' })),
        tools(call('grep_workspace', { query: 'no-such-token' })),
        tools(call('codebase_search', { query: 'focus', mode: 'text', root: 'src', limit: 5, path_glob: '*.ts' })),
        tools(call('get_open_files', {})),
        tools(call('web_search', { query: 'cameras' })),
        tools(call('web_search', { query: '' })),
        tools(call('read_project_memory', { category: 'note', query: 'focus' })),
        reply('done')
      ],
      {
        images: ['data:image/png;base64,aaaa'],
        attachedFiles: [{ name: 'note.txt', content: 'attached-body' }],
        openFiles: [{ path: 'Camera.ts', content: `${'A'.repeat(10000)}TAIL`, language: 'ts' }],
        history: [
          {
            id: 'h1',
            role: 'assistant',
            content: 'earlier',
            mode: 'agent',
            apiMessages: [
              {
                role: 'assistant',
                content: 'earlier question',
                tool_calls: [{ id: 'old', type: 'function', function: { name: 'read_file', arguments: '{}' } }]
              },
              { role: 'tool', content: 'old result', tool_call_id: 'old', name: 'read_file' }
            ]
          } as ChatMessage
        ]
      }
    )

    expect(events.find((event) => event.toolCall?.id === 'app-file')?.toolCall?.result).toContain('workspace.agentAppFolder')
    expect(events.find((event) => event.toolCall?.id === 'camera')?.toolCall?.result).toContain('cameraFocus')
    expect(toolOutput(events, 'read_files')).toContain('missing.ts')
    expect(toolOutput(events, 'read_files')).toContain('Error:')
    expect(events.filter((event) => event.type === 'tool_done' && event.toolCall?.name === 'read_files')[1]?.toolCall?.result).toContain(
      'missing_required_argument'
    )
    expect(events.filter((event) => event.type === 'tool_done' && event.toolCall?.name === 'read_files')[2]?.toolCall?.result).toContain(
      'missing_required_argument'
    )
    expect(toolOutput(events, 'list_directory')).toContain('[file] Camera.ts')
    expect(events.find((event) => event.toolCall?.id === 'list-root')?.toolCall?.result).toContain('[file] Camera.ts')
    expect(toolOutput(events, 'grep_workspace')).toContain('cameraFocus')
    expect(toolOutput(events, 'search_files')).toContain('uniqueZoomToken')
    expect(events.filter((event) => event.type === 'tool_done' && event.toolCall?.name === 'search_files')[1]?.toolCall?.result).toBe(
      'No matches found'
    )
    expect(toolOutput(events, 'grep_workspace').split('\n')).toHaveLength(1)
    expect(toolOutput(events, 'codebase_search')).toBe('src/Camera.ts:1-2 [text] cameraFocus focus')
    expect(toolOutput(events, 'get_open_files')).toContain('A')
    expect(toolOutput(events, 'get_open_files')).not.toContain('TAIL')
    expect(toolOutput(events, 'web_search')).toBe('**Docs**\nhttps://example.test\ncameras')
    expect(toolOutput(events, 'read_project_memory')).toContain('remembered focus')
    const userMessage = seenMessages.find((message) => message.role === 'user')
    expect(JSON.stringify(userMessage?.content)).toContain('attached-body')
    expect(JSON.stringify(userMessage?.content)).toContain('image_url')
    expect(JSON.stringify(seenMessages)).toContain('earlier question')
  })

  it('writes, patches, checks a command, and can roll the files back', async () => {
    const dir = workspace()
    writeFileSync(join(dir, 'Camera.ts'), 'alpha alpha')
    writeFileSync(join(dir, 'Pair.ts'), 'gamma gamma')
    writeFileSync(join(dir, 'Once.ts'), 'epsilon epsilon')
    const agent = create([
      tools(call('write_file', { path: 'Fresh.ts', content: 'fresh' })),
      tools(call('search_replace', { path: 'Camera.ts', old_string: 'alpha', new_string: 'beta', replace_all: true })),
      tools(call('search_replace', { path: 'Pair.ts', old_string: 'gamma', new_string: 'delta', replace_all: 'true' }, 'all-string')),
      tools(call('search_replace', { path: 'Once.ts', old_string: 'epsilon', new_string: 'zeta', replace_all: false }, 'one')),
      tools(call('run_terminal', { command: 'echo hi' })),
      reply('edited')
    ])
    const events: AgentEvent[] = []
    await agent.run('edit', { ...base(dir), projectMemory: 'notes' }, (event) => {
      events.push(event)
      if (event.type === 'approval_request' && event.approval) {
        queueMicrotask(() => agent.resolveApproval(event.approval!.id, true))
      }
    })

    expect(readFileSync(join(dir, 'Fresh.ts'), 'utf8')).toBe('fresh')
    expect(readFileSync(join(dir, 'Camera.ts'), 'utf8')).toBe('beta beta')
    expect(readFileSync(join(dir, 'Pair.ts'), 'utf8')).toBe('delta delta')
    expect(readFileSync(join(dir, 'Once.ts'), 'utf8')).toBe('epsilon epsilon')
    expect(events.find((event) => event.toolCall?.id === 'one')?.toolCall?.result).toContain('matched 2 times')
    expect(toolOutput(events, 'write_file')).toContain('Successfully wrote 5 characters')
    expect(
      events
        .find((event) => event.type === 'tool_done' && event.toolCall?.name === 'write_file')
        ?.toolCall?.fileDiff?.lines.some((line) => line.type === 'add' && line.content.includes('fresh'))
    ).toBe(true)
    expect(events.filter((event) => event.type === 'checkpoint_updated')).toHaveLength(4)
    expect(terminalCommand).toBe('echo hi')
    expect(events.some((event) => event.type === 'checkpoint_updated')).toBe(true)
    expect(events.some((event) => event.type === 'memory_suggest')).toBe(false)
    expect(agent.getRunCheckpointSummary()?.count).toBeGreaterThan(0)

    const details = await agent.getRunCheckpointDetails()
    expect(details?.some((detail) => detail.path.endsWith('Camera.ts') && detail.additions > 0)).toBe(true)

    const restored = await agent.restoreRunCheckpointPaths([join(dir, 'Camera.ts')])
    expect(restored?.restored).toBe(1)
    expect(readFileSync(join(dir, 'Camera.ts'), 'utf8')).toBe('alpha alpha')
    expect(existsSync(join(dir, 'Fresh.ts'))).toBe(true)

    const deleted = await agent.restoreRunCheckpoint()
    expect(deleted?.deleted).toBe(1)
    expect(existsSync(join(dir, 'Fresh.ts'))).toBe(false)
    expect(await agent.restoreRunCheckpoint()).toBeNull()
    expect(await agent.restoreRunCheckpointPaths([])).toBeNull()
    expect(agent.getRunCheckpointSummary()).toBeNull()
  })

  it('blocks a destructive command and refuses a write in ask mode', async () => {
    const dir = workspace()
    const blocked = await run(dir, [
      tools(call('run_terminal', { command: 'rm -rf /' })),
      tools(call('run_terminal', { command: '' }, 'empty-cmd')),
      reply('stopped')
    ])
    expect(terminalCommand).toBe('')
    expect(toolOutput(blocked, 'run_terminal')).toContain('Error')
    expect(blocked.find((event) => event.type === 'tool_done' && event.toolCall?.id === 'empty-cmd')?.toolCall?.result).toContain(
      'Error'
    )

    const ask = await run(
      dir,
      [tools(call('write_file', { path: 'x.ts', content: 'nope' })), reply('stopped')],
      { mode: 'ask', autoApproveWrites: false }
    )
    expect(existsSync(join(dir, 'x.ts'))).toBe(false)
    expect(ask.some((event) => event.type === 'tool_done' && event.toolCall?.name === 'write_file')).toBe(true)
  })

  it('lets the planner edit a saved plan and refuses a source file', async () => {
    const dir = workspace()
    const planDir = join(dir, '.openrouter', 'plans')
    mkdirSync(planDir, { recursive: true })
    writeFileSync(join(planDir, 'camera.md'), 'old plan')
    writeFileSync(join(dir, 'Camera.ts'), 'source')
    const events = await run(
      dir,
      [
        tools(call('search_replace', { path: '.openrouter/plans/camera.md', old_string: 'old', new_string: 'new' }, 'plan')),
        tools(call('search_replace', { path: 'Camera.ts', old_string: 'source', new_string: 'nope' }, 'source')),
        reply('planned')
      ],
      { mode: 'planner' }
    )

    expect(readFileSync(join(planDir, 'camera.md'), 'utf8')).toBe('new plan')
    expect(readFileSync(join(dir, 'Camera.ts'), 'utf8')).toBe('source')
    expect(events.find((event) => event.type === 'tool_done' && event.toolCall?.id === 'source')?.toolCall?.result).toContain(
      'tool_not_allowed_in_mode'
    )
  })

  it('remembers, checks off steps, calls MCP, and reports an unknown tool', async () => {
    const dir = workspace()
    mcpNeedsApproval = true
    const events = await run(dir, [
      tools(call('update_project_memory', { action: 'append', content: 'use the wide lens', category: 'note' })),
      tools(call('update_project_memory', { action: 'update', id: 'mem-1', content: 'wider', category: 'decision' }, 'update-mem')),
      tools(call('update_project_memory', { action: 'delete', id: 'mem-1' }, 'delete-mem')),
      tools(call('create_task_checklist', { steps: ['Open camera', 'Fix focus'] })),
      tools(call('update_task_checklist', { step: 1, status: 'done' })),
      tools(call('update_task_checklist', { step: 1, status: 'nope' }, 'bad-status')),
      tools(call('create_task_checklist', { steps: [] }, 'empty-list')),
      tools(call('create_task_checklist', { steps: Array.from({ length: 20 }, (_, i) => `s${i}`) }, 'twenty')),
      tools(call('create_task_checklist', { steps: Array.from({ length: 21 }, (_, i) => `step ${i}`) }, 'long-list')),
      tools(call('mcp__docs__search', { q: 'focus' })),
      tools(call('mcp__docs__danger_write', { q: 'x' }, 'mcp-danger')),
      tools(call('frobnicate', {})),
      reply('tracked')
    ])

    expect(memoryUpdate).toMatchObject({ action: 'delete' })
    expect(toolOutput(events, 'update_project_memory')).toContain('Saved memory entry mem-1')
    expect(events.find((event) => event.type === 'tool_done' && event.toolCall?.id === 'delete-mem')?.toolCall?.result).toBe(
      'Deleted memory entry mem-1'
    )
    expect(events.find((event) => event.type === 'tool_done' && event.toolCall?.id === 'update-mem')?.toolCall?.result).toContain(
      '(decision)'
    )
    expect(events.find((event) => event.toolCall?.id === 'twenty')?.toolCall?.result).toContain('s19')
    expect(events.some((event) => event.type === 'checklist_updated' && (event.checklist?.steps.length ?? 0) > 0)).toBe(
      true
    )
    expect(events.find((event) => event.type === 'tool_done' && event.toolCall?.id === 'bad-status')?.toolCall?.result).toContain(
      'status must be'
    )
    expect(events.find((event) => event.type === 'tool_done' && event.toolCall?.id === 'empty-list')?.toolCall?.result).toContain(
      'at least one'
    )
    expect(events.find((event) => event.type === 'tool_done' && event.toolCall?.id === 'long-list')?.toolCall?.result).toContain(
      'maximum 20'
    )
    expect(mcpCalls[0]).toContain('mcp__docs__search')
    expect(events.some((event) => event.type === 'approval_request' && event.approval?.name.includes('danger'))).toBe(
      true
    )
    expect(toolOutput(events, 'frobnicate')).toContain('unknown_tool')
  })

  it('surfaces a memory failure, a tool exception, and an empty model reply', async () => {
    const dir = workspace()
    memoryThrows = true
    const memoryEvents = await run(dir, [
      tools(call('update_project_memory', { action: 'append', content: 'nope' })),
      reply('after')
    ])
    expect(toolOutput(memoryEvents, 'update_project_memory')).toContain('memory locked')

    terminalThrows = true
    const failEvents = await run(dir, [
      tools(call('run_terminal', { command: 'echo hi' })),
      tools(call('run_terminal', { command: 'echo hi' }, 'again')),
      reply('gave up')
    ])
    expect(failEvents.some((event) => event.type === 'tool_done' && event.toolCall?.result?.includes('shell missing'))).toBe(
      true
    )
    expect(failEvents.some((event) => event.type === 'tool_done' && event.toolCall?.result?.includes('retry'))).toBe(
      true
    )
    terminalThrows = false

    const emptyEvents = await run(dir, [reply('')])
    expect(emptyEvents.some((event) => event.type === 'error')).toBe(true)

    const boom = create([reply('never')])
    ;(boom as unknown as { openRouter: { streamCompletion: () => Promise<never> } }).openRouter.streamCompletion =
      async () => {
        throw new Error('network down')
      }
    const boomEvents: AgentEvent[] = []
    await boom.run('go', base(dir), (event) => boomEvents.push(event))
    expect(boomEvents.some((event) => event.type === 'error' && event.error === 'network down')).toBe(true)
    expect(boomEvents.some((event) => event.type === 'run_status' && event.runStatus === 'error')).toBe(true)
  })

  it('does not run a terminal command when ask mode has no folder', async () => {
    const dir = workspace()
    const events = await run(
      dir,
      [tools(call('run_terminal', { command: 'echo hi' })), reply('done')],
      { mode: 'ask', workingDirectory: '' }
    )
    expect(toolOutput(events, 'run_terminal')).toContain('tool_not_allowed_in_mode')

    const askInside = await run(dir, [reply('ok')], { mode: 'ask', workingDirectory: process.cwd() })
    expect(askInside.some((event) => event.errorCode === 'workspace.agentAppFolder')).toBe(false)
    expect(askInside.some((event) => event.type === 'done' && event.message?.content === 'ok')).toBe(true)
  })

  it('reports misses, empty output, and a stopped run that already wrote a file', async () => {
    const dir = workspace()
    writeFileSync(join(dir, 'Camera.ts'), 'alpha')
    const events = await run(dir, [
      {
        ...tools(call('read_file', { path: 'gone.ts' })),
        content: 'about to look',
        chunks: ['about to look']
      },
      tools(call('search_replace', { path: 'Camera.ts', old_string: 'zzz', new_string: 'nope' })),
      tools(call('get_open_files', {})),
      tools(call('codebase_search', { query: 'none' })),
      tools(call('run_terminal', { command: 'quiet' }, 'quiet')),
      tools(call('run_terminal', { command: 'loud' }, 'loud')),
      reply('done')
    ])

    expect(events.some((event) => event.type === 'stream' && event.content === 'about to look')).toBe(true)
    expect(toolOutput(events, 'read_file')).toContain('Error')
    expect(toolOutput(events, 'search_replace')).toContain('old_string not found')
    expect(toolOutput(events, 'get_open_files')).toBe('No files are currently open')
    expect(toolOutput(events, 'codebase_search')).toBe('No matches found')
    expect(events.some((event) => event.type === 'terminal_output' && event.content === 'pong')).toBe(false)
    const loud = events.find((event) => event.type === 'terminal_output')
    expect(loud?.content?.length).toBeLessThanOrEqual(4000)
    expect(loud?.content?.endsWith('Z')).toBe(true)

    hangAfter = 1
    const agent = create([
      tools(call('write_file', { path: 'Fresh.ts', content: 'fresh' })),
      reply('never')
    ])
    const stopped: AgentEvent[] = []
    const pending = agent.run(
      'write then stop',
      { ...base(dir), model: 'test-model' },
      (event) => stopped.push(event)
    )
    await vi.waitFor(() => expect(existsSync(join(dir, 'Fresh.ts'))).toBe(true))
    agent.abort()
    await pending
    expect(agent.isRunning).toBe(false)
    expect(readFileSync(join(dir, 'Fresh.ts'), 'utf8')).toBe('fresh')
    expect(stopped.some((event) => event.type === 'checkpoint_updated')).toBe(true)
    expect(stopped.some((event) => event.type === 'run_status' && event.runStatus === 'aborted')).toBe(true)
  })

  it('asks before a patch, a command, and a memory edit, then remembers the allow', async () => {
    const dir = workspace()
    writeFileSync(join(dir, 'Camera.ts'), 'alpha')
    const asked = await run(
      dir,
      [
        tools(call('search_replace', { path: 'Camera.ts', old_string: 'alpha', new_string: 'beta' })),
        tools(call('run_terminal', { command: 'echo hi' })),
        tools(call('update_project_memory', { action: 'append', content: 'focus' })),
        tools(call('write_file', { path: 'Fresh.ts', content: 'fresh' })),
        tools(call('search_replace', { path: 'missing.ts', old_string: 'old', new_string: 'new' }, 'missing-patch')),
        reply('done')
      ],
      { autoApproveWrites: false, autoApproveTerminal: false }
    )

    const previews = asked
      .filter((event) => event.type === 'approval_request')
      .map((event) => event.approval?.preview ?? '')
    expect(previews.some((preview) => preview.startsWith('Patch Camera.ts'))).toBe(true)
    expect(previews.some((preview) => preview.startsWith('Run: echo hi'))).toBe(true)
    expect(previews.some((preview) => preview.includes('Update project memory (append)'))).toBe(true)
    expect(previews.some((preview) => preview.startsWith('Write Fresh.ts'))).toBe(true)
    const patch = asked.find((event) => event.type === 'approval_request' && event.approval?.name === 'search_replace')
    expect(patch?.approval?.fileDiff?.lines.length).toBeGreaterThan(0)
    const missing = asked.find((event) => event.type === 'approval_request' && event.approval?.toolCallId === 'missing-patch')
    expect(missing?.approval?.filePath).toBe('missing.ts')
    expect(readFileSync(join(dir, 'Camera.ts'), 'utf8')).toBe('beta')
    expect(terminalCommand).toBe('echo hi')
    expect(memoryUpdate).toMatchObject({ action: 'append' })

    const remembered = create([
      tools(call('run_terminal', { command: 'echo hi' })),
      tools(call('write_file', { path: 'Again.ts', content: 'again' })),
      reply('done')
    ])
    remembered.setSessionAutoApprove('run_terminal')
    remembered.setSessionAutoApprove('write_file')
    const quiet: AgentEvent[] = []
    await remembered.run(
      'again',
      { ...base(dir), model: 'test-model', autoApproveWrites: false, autoApproveTerminal: false },
      (event) => quiet.push(event)
    )
    expect(quiet.some((event) => event.type === 'approval_request')).toBe(false)
    expect(existsSync(join(dir, 'Again.ts'))).toBe(true)
  })

  it('stops reading once the file budget is spent and keeps an error on the answer', async () => {
    const dir = workspace()
    const big = 'A'.repeat(60_000)
    for (let i = 0; i < 4; i++) writeFileSync(join(dir, `big${i}.txt`), big)
    const events = await run(dir, [
      tools(call('read_files', { paths: ['big0.txt', 'big1.txt', 'big2.txt', 'big3.txt'] })),
      tools(call('create_task_checklist', { steps: ['One'] })),
      tools(call('update_task_checklist', { step: 9, status: 'done' }, 'bad-step')),
      reply('done')
    ])
    const batch = toolOutput(events, 'read_files')
    expect(batch.startsWith('===')).toBe(true)
    expect(batch).toContain('A'.repeat(50_000))
    expect(batch).not.toContain('A'.repeat(60_000))
    expect(batch.indexOf('budget exceeded')).toBeGreaterThan(batch.indexOf('A'.repeat(100)))
    expect(events.find((event) => event.toolCall?.id === 'bad-step')?.toolCall?.result).toContain('Invalid step number')

    throwAfter = 1
    const failed = await run(dir, [tools(call('read_file', { path: 'big0.txt' })), reply('never')])
    const done = failed.find((event) => event.type === 'done')
    expect(done?.message?.isError).toBe(true)
    expect(done?.message?.content).toContain('network down')
    expect(failed.some((event) => event.type === 'error' && event.error === 'network down')).toBe(false)
  })

  it('stops between steps after a file was written', async () => {
    const dir = workspace()
    const agent = create([
      tools(call('write_file', { path: 'Fresh.ts', content: 'fresh' })),
      reply('should not be asked')
    ])
    const events: AgentEvent[] = []
    await agent.run('write', { ...base(dir), model: 'test-model' }, (event) => {
      events.push(event)
      if (event.type === 'tool_done' && event.toolCall?.name === 'write_file') agent.abort()
    })
    expect(agent.isRunning).toBe(false)
    expect(events.some((event) => event.type === 'run_status' && event.runStatus === 'aborted')).toBe(true)
    expect(events.some((event) => event.type === 'done' && event.message?.interrupted)).toBe(true)
    expect(agent.getRunCheckpointSummary()?.count).toBeGreaterThan(0)
    expect(events.some((event) => event.type === 'stream' && event.content)).toBe(false)
    expect(events.some((event) => event.message?.content === 'should not be asked')).toBe(false)
  })

  it('passes tools, history, and a fresh checklist into the next turn', async () => {
    const dir = workspace()
    writeFileSync(join(dir, 'Camera.ts'), `${'A'.repeat(50_001)}Z`)
    terminalThrows = true
    const agent = create([
      tools(call('read_file', { path: 'Camera.ts' })),
      tools(call('create_task_checklist', { steps: ['Open camera'] })),
      tools(call('run_terminal', { command: 'echo hi' })),
      tools(call('run_terminal', { command: 'echo hi' }, 'again')),
      reply('first', { usage: { promptTokens: 2, completionTokens: 2, totalTokens: 4 } }),
      tools(call('run_terminal', { command: 'echo hi' }, 'later')),
      reply('second')
    ])
    const first: AgentEvent[] = []
    await agent.run(
      'do the task',
      {
        ...base(dir),
        model: 'test-model',
        temperature: 0.2,
        maxTokens: 64,
        images: [],
        history: [
          {
            id: 'h1',
            role: 'assistant',
            content: 'earlier',
            mode: 'agent',
            apiMessages: [
              {
                role: 'assistant',
                content: 'earlier question',
                tool_calls: [{ id: 'old', type: 'function', function: { name: 'read_file', arguments: '{}' } }]
              },
              { role: 'tool', content: 'old result', tool_call_id: 'old', name: 'read_file' }
            ]
          } as ChatMessage
        ]
      },
      (event) => first.push(event)
    )

    const read = toolOutput(first, 'read_file')
    expect(read).toHaveLength(50_000)
    expect(read.endsWith('A')).toBe(true)
    expect(seenTools.map((tool) => tool.function?.name)).toEqual(
      expect.arrayContaining(['read_file', 'write_file', 'mcp__docs__search'])
    )
    expect(seenCallOptions).toEqual({ model: 'test-model', temperature: 0.2, maxTokens: 64 })
    expect(first.some((event) => event.type === 'iteration_warning')).toBe(false)
    expect(seenMessages.find((message) => message.role === 'tool')).toMatchObject({
      content: 'old result',
      tool_call_id: 'old',
      name: 'read_file'
    })
    expect(
      seenMessages.some(
        (message) =>
          Array.isArray(message.tool_calls) &&
          (message.tool_calls as Array<{ id?: string }>)[0]?.id === 'old'
      )
    ).toBe(true)
    expect(typeof seenMessages.find((message) => message.role === 'user')?.content).toBe('string')

    const analytics = first.find((event) => event.type === 'run_analytics')?.analytics
    expect(analytics).toMatchObject({
      model: 'test-model',
      iterations: 5,
      userMessagePreview: 'do the task',
      tokenUsage: { promptTokens: 2, completionTokens: 2, totalTokens: 4 }
    })
    const done = first.find((event) => event.type === 'done')
    expect(done?.message?.apiMessages?.[0]?.role).toBe('assistant')
    expect(done?.message?.apiMessages?.at(-1)).toMatchObject({ role: 'assistant', content: 'first' })
    expect(done?.message?.apiMessages?.some((message) => message.role === 'system')).toBe(false)
    expect(done?.message?.apiMessages?.find((message) => message.name === 'read_file')?.content).toHaveLength(50_000)
    expect(done?.message?.timeline?.some((item) => item.type === 'text' && item.content === 'first')).toBe(true)
    expect(first.find((event) => event.type === 'checklist_updated')?.checklist?.steps).toEqual([])

    const second: AgentEvent[] = []
    await agent.run('again', { ...base(dir), model: 'test-model' }, (event) => second.push(event))
    expect(second.find((event) => event.type === 'checklist_updated')?.checklist?.steps).toEqual([])
    const later = second.find((event) => event.toolCall?.id === 'later')?.toolCall?.result ?? ''
    expect(later).toContain('shell missing')
    expect(later).not.toContain('retry_exhausted')
  })
})

function base(dir: string): AgentContext {
  return {
    mode: 'agent',
    workingDirectory: dir,
    openFiles: [],
    history: [],
    autoApproveWrites: true,
    autoApproveTerminal: true
  }
}
