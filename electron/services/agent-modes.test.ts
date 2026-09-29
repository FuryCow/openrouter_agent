import { describe, expect, it } from 'vitest'
import {
  buildSystemPrompt,
  expandHistoryForApi,
  filterHistoryForApi,
  getMaxIterations,
  getToolsForMode,
  isToolAllowedInMode
} from '../services/agent-modes'
import type { AgentContext, ChatMessage } from '../types'
import type { ToolDefinition } from '../services/openrouter'

const ALL_TOOLS: ToolDefinition[] = [
  { type: 'function', function: { name: 'read_files', description: '', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'grep_workspace', description: '', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'search_replace', description: '', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'write_file', description: '', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'run_terminal', description: '', parameters: { type: 'object', properties: {} } } }
]

const baseContext: AgentContext = {
  mode: 'agent',
  workingDirectory: '/proj',
  openFiles: [],
  history: [],
  model: 'test/model',
  customSystemPrompt: '',
  autoApproveWrites: false,
  autoApproveTerminal: false
}

describe('agent-modes history', () => {
  it('filters error messages from history', () => {
    const history: ChatMessage[] = [
      { id: '1', role: 'user', content: 'hi' },
      { id: '2', role: 'assistant', content: '⚠️ failed', isError: true }
    ]
    expect(filterHistoryForApi(history, 'agent')).toHaveLength(1)
  })

  it('keeps interrupted tool context without duplicating the user prompt', () => {
    const history: ChatMessage[] = [
      { id: '1', role: 'user', content: 'fix tests' },
      {
        id: '2',
        role: 'assistant',
        content: '',
        interrupted: true,
        runOutcome: 'aborted',
        apiMessages: [
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }
            ]
          },
          { role: 'tool', content: 'file', tool_call_id: 'c1', name: 'read_file' }
        ]
      }
    ]
    const filtered = filterHistoryForApi(history, 'agent')
    expect(filtered).toHaveLength(2)
    const expanded = expandHistoryForApi(filtered, 'agent')
    expect(expanded).toHaveLength(3)
    expect(expanded.filter((message) => message.role === 'user')).toHaveLength(1)
  })

  it('keeps the visible reply after a tool round', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'done',
        apiMessages: [
          { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
          { role: 'tool', content: 'file contents', tool_call_id: 'c1', name: 'read_file' }
        ]
      }
    ]
    const expanded = expandHistoryForApi(history, 'agent')
    expect(expanded.map((message) => message.role)).toEqual(['assistant', 'tool', 'assistant'])
    expect(expanded[2].content).toBe('done')
  })

  it('does not repeat a conclusion already stored at the end of the tool log', () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'done',
        apiMessages: [
          { role: 'tool', content: 'file contents', tool_call_id: 'c1', name: 'read_file' },
          { role: 'assistant', content: 'done' }
        ]
      }
    ]
    const expanded = expandHistoryForApi(history, 'agent')
    expect(expanded.filter((message) => message.content === 'done')).toHaveLength(1)
  })

  it('does not invent a reply for an empty or interrupted turn', () => {
    const toolLog: ChatMessage['apiMessages'] = [
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
      { role: 'tool', content: 'file', tool_call_id: 'c1', name: 'read_file' }
    ]
    const empty = expandHistoryForApi(
      [{ id: '1', role: 'assistant', content: '', apiMessages: toolLog }],
      'agent'
    )
    expect(empty).toEqual([])

    const interrupted = expandHistoryForApi(
      [{ id: '1', role: 'assistant', content: '', interrupted: true, apiMessages: toolLog }],
      'agent'
    )
    expect(interrupted).toHaveLength(2)
  })

  it('drops an older tool round whole and keeps the latest reply', () => {
    const oldCall = [{ id: 'old', type: 'function' as const, function: { name: 'read_file', arguments: '{}' } }]
    const newCall = [{ id: 'new', type: 'function' as const, function: { name: 'read_file', arguments: '{}' } }]
    const history: ChatMessage[] = [
      { id: 'u', role: 'user', content: 'go' },
      {
        id: '1',
        role: 'assistant',
        content: 'the answer',
        apiMessages: [
          { role: 'assistant', content: null, tool_calls: oldCall },
          { role: 'tool', content: 'x'.repeat(400), tool_call_id: 'old', name: 'read_file' },
          { role: 'assistant', content: null, tool_calls: newCall },
          { role: 'tool', content: 'short', tool_call_id: 'new', name: 'read_file' }
        ]
      }
    ]
    const expanded = expandHistoryForApi(history, 'agent', 80)
    expect(expanded.some((message) => message.tool_calls?.[0]?.id === 'old')).toBe(false)
    expect(expanded.some((message) => message.tool_call_id === 'old')).toBe(false)
    expect(expanded.some((message) => message.tool_calls?.[0]?.id === 'new')).toBe(true)
    expect(expanded.some((message) => message.tool_call_id === 'new')).toBe(true)
    expect(expanded.at(-1)).toMatchObject({ role: 'assistant', content: 'the answer' })
  })
})

describe('agent-modes limits and tools', () => {
  it('does not cap tool steps in any mode', () => {
    expect(getMaxIterations('agent')).toBe(Number.POSITIVE_INFINITY)
    expect(getMaxIterations('planner')).toBe(Number.POSITIVE_INFINITY)
    expect(getMaxIterations('ask')).toBe(Number.POSITIVE_INFINITY)
  })

  it('exposes search_replace to planner but not write_file', () => {
    const plannerTools = getToolsForMode('planner', ALL_TOOLS).map((t) => t.function.name)
    expect(plannerTools).toContain('read_files')
    expect(plannerTools).toContain('grep_workspace')
    expect(plannerTools).toContain('search_replace')
    expect(plannerTools).not.toContain('write_file')
    expect(plannerTools).not.toContain('run_terminal')
  })

  it('allows all tools in agent mode', () => {
    expect(isToolAllowedInMode('write_file', 'agent')).toBe(true)
    expect(isToolAllowedInMode('grep_workspace', 'planner')).toBe(true)
    expect(isToolAllowedInMode('search_replace', 'planner')).toBe(true)
    expect(isToolAllowedInMode('write_file', 'planner')).toBe(false)
    expect(isToolAllowedInMode('read_files', 'ask')).toBe(true)
    expect(isToolAllowedInMode('grep_workspace', 'ask')).toBe(true)
    expect(isToolAllowedInMode('write_file', 'ask')).toBe(false)
    expect(getToolsForMode('ask', ALL_TOOLS).map((t) => t.function.name)).toEqual([
      'read_files',
      'grep_workspace'
    ])
    expect(isToolAllowedInMode('search_replace', 'ask')).toBe(false)
    expect(isToolAllowedInMode('run_terminal', 'ask')).toBe(false)
    expect(isToolAllowedInMode('run_terminal', 'planner')).toBe(false)
    expect(isToolAllowedInMode('mcp__srv__read_file', 'ask')).toBe(false)
    expect(isToolAllowedInMode('mcp__srv__read_file', 'planner')).toBe(true)
    expect(isToolAllowedInMode('mcp__srv__write_file', 'planner')).toBe(false)
    expect(isToolAllowedInMode('mcp__srv__write_file', 'agent')).toBe(true)
    expect(isToolAllowedInMode('mcp__broken', 'planner')).toBe(false)
  })
})

describe('buildSystemPrompt', () => {
  it('includes batch editing and anti-shell-search guidance for agent', () => {
    const prompt = buildSystemPrompt(baseContext)
    expect(prompt).toContain('read_files')
    expect(prompt).toContain('grep_workspace')
    expect(prompt).toContain('multiple tool_calls')
    expect(prompt).toContain('Do NOT use run_terminal for grep')
  })

  it('includes project memory section for agent when provided', () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      projectMemory: '## Dynamic memory\n- Use SQLite for indexing'
    })
    expect(prompt).toContain('Project memory (workspace-specific')
    expect(prompt).toContain('Use SQLite for indexing')
    expect(prompt).toContain('update_project_memory')
  })

  it('exposes read_project_memory to planner but not update_project_memory', () => {
    const plannerTools = getToolsForMode('planner', [
      ...ALL_TOOLS,
      {
        type: 'function',
        function: {
          name: 'read_project_memory',
          description: '',
          parameters: { type: 'object', properties: {} }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_project_memory',
          description: '',
          parameters: { type: 'object', properties: {} }
        }
      }
    ]).map((tool) => tool.function.name)

    expect(plannerTools).toContain('read_project_memory')
    expect(plannerTools).not.toContain('update_project_memory')
    expect(isToolAllowedInMode('read_project_memory', 'planner')).toBe(true)
    expect(isToolAllowedInMode('update_project_memory', 'planner')).toBe(false)
  })

  it('includes read-only project memory section for planner when provided', () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      mode: 'planner',
      projectMemory: '## Dynamic memory\n- Use SQLite for indexing'
    })
    expect(prompt).toContain('Project memory (workspace-specific; read-only in planner mode)')
    expect(prompt).toContain('Use SQLite for indexing')
    expect(prompt).not.toContain('update_project_memory')
  })

  it('tells ask mode to read the workspace and not to edit it', () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      mode: 'ask',
      openFiles: [{ path: 'src/app.ts', language: 'typescript', content: 'export const n = 1' }]
    })
    expect(prompt).toContain('read_files')
    expect(prompt).toContain('export const n = 1')
    expect(prompt).not.toContain('do NOT have tools')
  })

  it('includes batch read guidance for planner', () => {
    const prompt = buildSystemPrompt({ ...baseContext, mode: 'planner' })
    expect(prompt).toContain('read_files')
    expect(prompt).toContain('grep_workspace')
    expect(prompt).not.toContain('run_terminal for builds')
  })

  it('includes workspace state for agent and planner', () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      workspaceState: 'Branch: main\nWorking tree: clean'
    })
    expect(prompt).toContain('Workspace state:')
    expect(prompt).toContain('Branch: main')

    const plannerPrompt = buildSystemPrompt({
      ...baseContext,
      mode: 'planner',
      workspaceState: 'Branch: dev'
    })
    expect(plannerPrompt).toContain('Workspace state:')
  })

  it('includes verification workflow when agentAutoVerify is enabled', () => {
    const prompt = buildSystemPrompt({ ...baseContext, agentAutoVerify: true })
    expect(prompt).toContain('Verification workflow')
    expect(prompt).toContain('npm test')
  })

  it('omits verification workflow when agentAutoVerify is disabled', () => {
    const prompt = buildSystemPrompt({ ...baseContext, agentAutoVerify: false })
    expect(prompt).not.toContain('Verification workflow')
  })
})
