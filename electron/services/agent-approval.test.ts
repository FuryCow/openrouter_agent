import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

function writeCall(content: string): ToolCall {
  return {
    id: 'call-write',
    type: 'function',
    function: {
      name: 'write_file',
      arguments: JSON.stringify({ path: 'notes.txt', content })
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

function context(dir: string): AgentContext {
  return {
    mode: 'agent',
    workingDirectory: dir,
    openFiles: [],
    history: []
  }
}

describe('approving or stopping a file edit', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function workspace(): { dir: string; file: string } {
    const userData = mkdtempSync(join(tmpdir(), 'agent-user-'))
    const dir = mkdtempSync(join(tmpdir(), 'agent-work-'))
    dirs.push(userData, dir)
    ;(globalThis as { __agentUserData?: string }).__agentUserData = userData
    return { dir, file: join(dir, 'notes.txt') }
  }

  it('writes the file when the user approves', async () => {
    const { dir, file } = workspace()
    const agent = createAgent(
      scriptedModel([
        { content: '', reasoning: '', toolCalls: [writeCall('approved text')], finishReason: 'tool_calls' },
        { content: 'Wrote the note.', reasoning: '', toolCalls: [], finishReason: 'stop' }
      ])
    )
    const events: AgentEvent[] = []

    await agent.run('save a note', context(dir), (event) => {
      events.push(event)
      if (event.type === 'approval_request' && event.approval) {
        queueMicrotask(() => agent.resolveApproval(event.approval!.id, true))
      }
    })

    expect(readFileSync(file, 'utf8')).toBe('approved text')
    expect(events.some((event) => event.type === 'approval_request')).toBe(true)
  })

  it('leaves the file untouched when the user rejects the edit', async () => {
    const { dir, file } = workspace()
    const agent = createAgent(
      scriptedModel([
        { content: '', reasoning: '', toolCalls: [writeCall('should not land')], finishReason: 'tool_calls' },
        { content: 'Skipped.', reasoning: '', toolCalls: [], finishReason: 'stop' }
      ])
    )

    await agent.run('save a note', context(dir), (event) => {
      if (event.type === 'approval_request' && event.approval) {
        queueMicrotask(() => agent.resolveApproval(event.approval!.id, false))
      }
    })

    expect(existsSync(file)).toBe(false)
  })

  it('writes without asking again after always allow for this session', async () => {
    const { dir, file } = workspace()
    const agent = createAgent(
      scriptedModel([
        { content: '', reasoning: '', toolCalls: [writeCall('auto')], finishReason: 'tool_calls' },
        { content: 'Wrote it.', reasoning: '', toolCalls: [], finishReason: 'stop' }
      ])
    )
    const events: AgentEvent[] = []
    agent.setSessionAutoApprove('write_file')

    await agent.run('save a note', context(dir), (event) => {
      events.push(event)
    })

    expect(readFileSync(file, 'utf8')).toBe('auto')
    expect(events.some((event) => event.type === 'approval_request')).toBe(false)
  })

  it('stops the answer when the user aborts, and does not write a file', async () => {
    const { dir, file } = workspace()
    let releaseAbort: () => void = () => {}
    const aborted = new Promise<void>((resolve) => {
      releaseAbort = resolve
    })
    const agent = createAgent({
      hasApiKey: () => true,
      streamCompletion: (_messages, _tools, options) =>
        new Promise<StreamResult>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            releaseAbort()
            reject(new Error('aborted'))
          })
        })
    })
    const events: AgentEvent[] = []

    const running = agent.run('keep talking', context(dir), (event) => {
      events.push(event)
    })
    await vi.waitFor(() => {
      expect(events.some((event) => event.type === 'run_status' && event.runStatus === 'running')).toBe(
        true
      )
    })
    agent.abort()
    await aborted
    await running

    expect(existsSync(file)).toBe(false)
    expect(events.some((event) => event.type === 'run_status' && event.runStatus === 'aborted')).toBe(true)
    expect(events.some((event) => event.type === 'done' && event.message?.interrupted)).toBe(true)
  })
})
