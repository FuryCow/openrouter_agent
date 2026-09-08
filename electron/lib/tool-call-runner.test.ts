import { describe, expect, it, vi } from 'vitest'
import type { ToolCall } from '../services/openrouter'
import { processToolCallsBatch } from './tool-call-runner'

function tool(name: string, args: Record<string, unknown>, id: string): ToolCall {
  return {
    id,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) }
  }
}

describe('processToolCallsBatch', () => {
  const cwd = '/proj'

  it('skips approval for read-only tools', async () => {
    const requestApproval = vi.fn(async () => false)
    const executeTool = vi.fn(async () => 'ok')
    const timeline: Parameters<typeof processToolCallsBatch>[0]['timeline'] = []
    const messages: Parameters<typeof processToolCallsBatch>[0]['messages'] = []

    await processToolCallsBatch({
      toolCalls: [tool('grep_workspace', { query: 'foo' }, '1')],
      mode: 'agent',
      cwd,
      iteration: 1,
      timeline,
      messages,
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onRecordAnalytics: vi.fn(),
      requestApproval,
      executeTool
    })

    expect(requestApproval).not.toHaveBeenCalled()
    expect(executeTool).toHaveBeenCalledTimes(1)
    expect(messages[0]?.content).toBe('ok')
  })

  it('normalizes grep alias to grep_workspace before execution', async () => {
    const executeTool = vi.fn(async (call: ToolCall) => {
      expect(call.function.name).toBe('grep_workspace')
      expect(JSON.parse(call.function.arguments).query).toBe('className')
      return 'match'
    })

    await processToolCallsBatch({
      toolCalls: [tool('grep', { pattern: 'className', path: 'src' }, '1')],
      mode: 'agent',
      cwd,
      iteration: 1,
      timeline: [],
      messages: [],
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onRecordAnalytics: vi.fn(),
      requestApproval: vi.fn(),
      executeTool
    })

    expect(executeTool).toHaveBeenCalledTimes(1)
  })

  it('requests approval sequentially for mutating tools', async () => {
    const order: string[] = []
    const requestApproval = vi.fn(async (call: ToolCall) => {
      order.push(`approve:${call.id}`)
      return true
    })
    const executeTool = vi.fn(async (call: ToolCall) => {
      order.push(`exec:${call.id}`)
      return 'done'
    })

    await processToolCallsBatch({
      toolCalls: [
        tool('search_replace', { path: 'a.html', old_string: 'x', new_string: 'y' }, '1'),
        tool('search_replace', { path: 'b.html', old_string: 'x', new_string: 'y' }, '2')
      ],
      mode: 'agent',
      cwd,
      iteration: 1,
      timeline: [],
      messages: [],
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onRecordAnalytics: vi.fn(),
      requestApproval,
      executeTool
    })

    expect(order.indexOf('approve:1')).toBeLessThan(order.indexOf('approve:2'))
    expect(order.indexOf('approve:2')).toBeLessThan(order.indexOf('exec:1'))
  })

  it('does not execute rejected mutating tools', async () => {
    const executeTool = vi.fn(async () => 'should not run')

    await processToolCallsBatch({
      toolCalls: [
        tool('search_replace', { path: 'a.html', old_string: 'x', new_string: 'y' }, '1')
      ],
      mode: 'agent',
      cwd,
      iteration: 1,
      timeline: [],
      messages: [],
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onRecordAnalytics: vi.fn(),
      requestApproval: vi.fn(async () => false),
      executeTool
    })

    expect(executeTool).not.toHaveBeenCalled()
  })

  it('executes patches on different files in parallel within one wave', async () => {
    const started: string[] = []
    let active = 0
    let maxActive = 0

    const executeTool = vi.fn(async (call: ToolCall) => {
      started.push(`start:${call.id}`)
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 20))
      active--
      started.push(`end:${call.id}`)
      return 'ok'
    })

    await processToolCallsBatch({
      toolCalls: [
        tool('search_replace', { path: 'a.html', old_string: 'x', new_string: 'y' }, '1'),
        tool('search_replace', { path: 'b.html', old_string: 'x', new_string: 'y' }, '2')
      ],
      mode: 'agent',
      cwd,
      iteration: 1,
      timeline: [],
      messages: [],
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onRecordAnalytics: vi.fn(),
      requestApproval: vi.fn(async () => true),
      executeTool
    })

    expect(maxActive).toBe(2)
    expect(started.indexOf('start:1')).toBeLessThan(started.indexOf('end:2'))
    expect(started.indexOf('start:2')).toBeLessThan(started.indexOf('end:1'))
  })

  it('executes two patches to the same file sequentially', async () => {
    const order: string[] = []
    const executeTool = vi.fn(async (call: ToolCall) => {
      order.push(`exec:${call.id}`)
      await new Promise((r) => setTimeout(r, 5))
      return 'ok'
    })

    await processToolCallsBatch({
      toolCalls: [
        tool('search_replace', { path: 'a.html', old_string: 'x', new_string: 'y' }, '1'),
        tool('search_replace', { path: 'a.html', old_string: 'y', new_string: 'z' }, '2')
      ],
      mode: 'agent',
      cwd,
      iteration: 1,
      timeline: [],
      messages: [],
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onRecordAnalytics: vi.fn(),
      requestApproval: vi.fn(async () => true),
      executeTool
    })

    expect(order).toEqual(['exec:1', 'exec:2'])
  })

  it('preserves tool result message order matching tool_calls order', async () => {
    const messages: Parameters<typeof processToolCallsBatch>[0]['messages'] = []

    await processToolCallsBatch({
      toolCalls: [
        tool('grep_workspace', { query: 'a' }, '1'),
        tool('grep_workspace', { query: 'b' }, '2'),
        tool('grep_workspace', { query: 'c' }, '3')
      ],
      mode: 'agent',
      cwd,
      iteration: 1,
      timeline: [],
      messages,
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onRecordAnalytics: vi.fn(),
      requestApproval: vi.fn(async () => true),
      executeTool: vi.fn(async (call) => `result:${call.id}`)
    })

    expect(messages.map((m) => m.tool_call_id)).toEqual(['1', '2', '3'])
  })

  it('records invalid args without calling approval or execute', async () => {
    const requestApproval = vi.fn()
    const executeTool = vi.fn()
    const onRecordAnalytics = vi.fn()

    await processToolCallsBatch({
      toolCalls: [tool('read_files', { paths: [] }, '1')],
      mode: 'agent',
      cwd,
      iteration: 1,
      timeline: [],
      messages: [],
      onToolStart: vi.fn(),
      onToolDone: vi.fn(),
      onRecordAnalytics,
      requestApproval,
      executeTool
    })

    expect(requestApproval).not.toHaveBeenCalled()
    expect(executeTool).not.toHaveBeenCalled()
    expect(onRecordAnalytics.mock.calls[0]?.[0].outcome).toBe('invalid_args')
  })
})
