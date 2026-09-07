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

  it('expands apiMessages when present', () => {
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
    expect(expanded).toHaveLength(2)
    expect(expanded[1].role).toBe('tool')
  })
})

describe('agent-modes limits and tools', () => {
  it('uses raised iteration limits', () => {
    expect(getMaxIterations('agent')).toBe(50)
    expect(getMaxIterations('planner')).toBe(25)
    expect(getMaxIterations('ask')).toBe(1)
  })

  it('exposes read-only tools to planner but not mutating ones', () => {
    const plannerTools = getToolsForMode('planner', ALL_TOOLS).map((t) => t.function.name)
    expect(plannerTools).toContain('read_files')
    expect(plannerTools).toContain('grep_workspace')
    expect(plannerTools).not.toContain('write_file')
    expect(plannerTools).not.toContain('run_terminal')
  })

  it('allows all tools in agent mode', () => {
    expect(isToolAllowedInMode('write_file', 'agent')).toBe(true)
    expect(isToolAllowedInMode('grep_workspace', 'planner')).toBe(true)
    expect(isToolAllowedInMode('write_file', 'planner')).toBe(false)
    expect(isToolAllowedInMode('read_files', 'ask')).toBe(false)
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

  it('does not expose memory tools to planner', () => {
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

    expect(plannerTools).not.toContain('read_project_memory')
    expect(plannerTools).not.toContain('update_project_memory')
    expect(isToolAllowedInMode('update_project_memory', 'planner')).toBe(false)
  })

  it('includes batch read guidance for planner', () => {
    const prompt = buildSystemPrompt({ ...baseContext, mode: 'planner' })
    expect(prompt).toContain('read_files')
    expect(prompt).toContain('grep_workspace')
    expect(prompt).not.toContain('run_terminal for builds')
  })
})
