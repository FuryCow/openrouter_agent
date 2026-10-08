import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentContext, AgentEvent } from '../types'
import type { StreamResult, ToolCall } from './openrouter'

vi.mock('electron', () => ({
  app: {
    getPath: () => (globalThis as { __agentUserData?: string }).__agentUserData ?? ''
  }
}))

import { AgentService } from './agent'
import { FileSystemService } from './filesystem'
import type { CodebaseIndexer } from './indexing/codebase-indexer'
import type { McpManager } from './mcp/mcp-manager'
import type { ProjectMemoryService } from './project-memory/project-memory-service'
import type { TerminalService } from './terminal'
import type { WebSearchService } from './websearch'

function enqueueCall(args: Record<string, unknown>): ToolCall {
  return {
    id: 'call-enqueue',
    type: 'function',
    function: {
      name: 'enqueue_task',
      arguments: JSON.stringify(args)
    }
  }
}

function scriptedModel(steps: StreamResult[]) {
  let index = 0
  return {
    hasApiKey: () => true,
    streamCompletion: async (): Promise<StreamResult> => {
      const next = steps[index]
      index += 1
      if (!next) throw new Error('model had no further reply')
      return next
    }
  }
}

function createAgent(model: ReturnType<typeof scriptedModel>): AgentService {
  const mcp = {
    getToolsForMode: () => [],
    getConnectedServerSummaries: () => [],
    isMcpTool: () => false,
    requiresApproval: () => false
  }
  return new AgentService(
    model as never,
    new FileSystemService(),
    {} as TerminalService,
    {} as WebSearchService,
    {} as CodebaseIndexer,
    mcp as unknown as McpManager,
    { read: () => '', update: () => null } as unknown as ProjectMemoryService
  )
}

function context(dir: string, overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    mode: 'agent',
    workingDirectory: dir,
    openFiles: [],
    history: [],
    ...overrides
  }
}

describe('enqueue_task tool', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function workspace(): string {
    const userData = mkdtempSync(join(tmpdir(), 'agent-user-'))
    const dir = mkdtempSync(join(tmpdir(), 'agent-work-'))
    dirs.push(userData, dir)
    ;(globalThis as { __agentUserData?: string }).__agentUserData = userData
    return dir
  }

  it('enqueues via the bridge and returns the task id', async () => {
    const dir = workspace()
    const agent = createAgent(
      scriptedModel([
        {
          content: '',
          reasoning: '',
          toolCalls: [
            enqueueCall({ title: 'Write tests', prompt: 'Add tests for src/app.ts' })
          ],
          finishReason: 'tool_calls'
        },
        { content: 'Enqueued.', reasoning: '', toolCalls: [], finishReason: 'stop' }
      ])
    )
    const enqueued: Array<{ title: string; prompt: string; dependsOn: string[] }> = []
    agent.setTaskEnqueuer(async (title, prompt, dependsOn) => {
      enqueued.push({ title, prompt, dependsOn })
      return { id: 'qtask-123', title, dependsOn }
    })

    const events: AgentEvent[] = []
    await agent.run(
      'split the work',
      context(dir, { runQueueEnabled: true }),
      (event) => {
        events.push(event)
        if (event.type === 'approval_request' && event.approval) {
          queueMicrotask(() => agent.resolveApproval(event.approval!.id, true))
        }
      }
    )

    expect(enqueued).toEqual([
      { title: 'Write tests', prompt: 'Add tests for src/app.ts', dependsOn: [] }
    ])
    const toolDone = events.find((event) => event.type === 'tool_done')
    expect(toolDone?.toolCall?.result).toContain('qtask-123')
    expect(toolDone?.toolCall?.result).toContain('Write tests')
  })

  it('passes dependsOn through to the bridge', async () => {
    const dir = workspace()
    const agent = createAgent(
      scriptedModel([
        {
          content: '',
          reasoning: '',
          toolCalls: [
            enqueueCall({
              title: 'Run checks',
              prompt: 'npm test',
              dependsOn: ['qtask-1', 'qtask-2']
            })
          ],
          finishReason: 'tool_calls'
        },
        { content: 'ok', reasoning: '', toolCalls: [], finishReason: 'stop' }
      ])
    )
    let receivedDeps: string[] = []
    agent.setTaskEnqueuer(async (title, prompt, dependsOn) => {
      receivedDeps = dependsOn
      return { id: 'qtask-3', title, dependsOn }
    })

    await agent.run('chain tasks', context(dir, { runQueueEnabled: true }), (event) => {
      if (event.type === 'approval_request' && event.approval) {
        queueMicrotask(() => agent.resolveApproval(event.approval!.id, true))
      }
    })
    expect(receivedDeps).toEqual(['qtask-1', 'qtask-2'])
  })

  it('returns an error when the queue is disabled (no bridge)', async () => {
    const dir = workspace()
    const agent = createAgent(
      scriptedModel([
        {
          content: '',
          reasoning: '',
          toolCalls: [enqueueCall({ title: 'T', prompt: 'P' })],
          finishReason: 'tool_calls'
        },
        { content: 'done', reasoning: '', toolCalls: [], finishReason: 'stop' }
      ])
    )

    const events: AgentEvent[] = []
    await agent.run('try enqueue', context(dir, { runQueueEnabled: true }), (event) => {
      events.push(event)
      if (event.type === 'approval_request' && event.approval) {
        queueMicrotask(() => agent.resolveApproval(event.approval!.id, true))
      }
    })

    const toolDone = events.find((event) => event.type === 'tool_done')
    expect(toolDone?.toolCall?.result).toContain('Task queue is disabled')
  })

  it('returns an error when the flag is off even with a bridge', async () => {
    const dir = workspace()
    const agent = createAgent(
      scriptedModel([
        {
          content: '',
          reasoning: '',
          toolCalls: [enqueueCall({ title: 'T', prompt: 'P' })],
          finishReason: 'tool_calls'
        },
        { content: 'done', reasoning: '', toolCalls: [], finishReason: 'stop' }
      ])
    )
    agent.setTaskEnqueuer(async (title) => ({ id: 'qtask-x', title, dependsOn: [] }))

    const events: AgentEvent[] = []
    await agent.run('try enqueue', context(dir), (event) => {
      events.push(event)
      if (event.type === 'approval_request' && event.approval) {
        queueMicrotask(() => agent.resolveApproval(event.approval!.id, true))
      }
    })

    const toolDone = events.find((event) => event.type === 'tool_done')
    expect(toolDone?.toolCall?.result).toContain('Task queue is disabled')
  })

  it('surfaces queue validation errors to the model', async () => {
    const dir = workspace()
    const agent = createAgent(
      scriptedModel([
        {
          content: '',
          reasoning: '',
          toolCalls: [enqueueCall({ title: 'T', prompt: 'P' })],
          finishReason: 'tool_calls'
        },
        { content: 'done', reasoning: '', toolCalls: [], finishReason: 'stop' }
      ])
    )
    agent.setTaskEnqueuer(async () => {
      throw new Error('Too many pending tasks (max 20)')
    })

    const events: AgentEvent[] = []
    await agent.run('try enqueue', context(dir, { runQueueEnabled: true }), (event) => {
      events.push(event)
      if (event.type === 'approval_request' && event.approval) {
        queueMicrotask(() => agent.resolveApproval(event.approval!.id, true))
      }
    })

    const toolDone = events.find((event) => event.type === 'tool_done')
    expect(toolDone?.toolCall?.result).toContain('Too many pending tasks')
  })

  it('requires approval with a non-empty preview', async () => {
    const dir = workspace()
    const agent = createAgent(
      scriptedModel([
        {
          content: '',
          reasoning: '',
          toolCalls: [enqueueCall({ title: 'Review my diff', prompt: 'Do review' })],
          finishReason: 'tool_calls'
        },
        { content: 'ok', reasoning: '', toolCalls: [], finishReason: 'stop' }
      ])
    )
    agent.setTaskEnqueuer(async (title) => ({ id: 'qtask-9', title, dependsOn: [] }))

    const events: AgentEvent[] = []
    await agent.run('enqueue something', context(dir, { runQueueEnabled: true }), (event) => {
      events.push(event)
      if (event.type === 'approval_request' && event.approval) {
        expect(event.approval.preview).toBe('Enqueue task: Review my diff')
        queueMicrotask(() => agent.resolveApproval(event.approval!.id, true))
      }
    })

    expect(events.some((event) => event.type === 'approval_request')).toBe(true)
  })

  it('hides the tool from the tool list when the flag is off', async () => {
    const dir = workspace()
    let seenTools: string[] = []
    const agent = createAgent({
      hasApiKey: () => true,
      streamCompletion: async (_messages, tools) => {
        seenTools = tools.map((tool) => tool.function.name)
        return { content: 'done', reasoning: '', toolCalls: [], finishReason: 'stop' }
      }
    })

    await agent.run('hello', context(dir), () => {})
    expect(seenTools).not.toContain('enqueue_task')

    await agent.run('hello', context(dir, { runQueueEnabled: true }), () => {})
    expect(seenTools).toContain('enqueue_task')
  })

  it('never exposes enqueue_task in ask or planner modes', async () => {
    const dir = workspace()
    let seenTools: string[] = []
    const agent = createAgent({
      hasApiKey: () => true,
      streamCompletion: async (_messages, tools) => {
        seenTools = tools.map((tool) => tool.function.name)
        return { content: 'done', reasoning: '', toolCalls: [], finishReason: 'stop' }
      }
    })

    await agent.run('hello', context(dir, { runQueueEnabled: true, mode: 'ask' }), () => {})
    expect(seenTools).not.toContain('enqueue_task')

    await agent.run('hello', context(dir, { runQueueEnabled: true, mode: 'planner' }), () => {})
    expect(seenTools).not.toContain('enqueue_task')
  })
})
