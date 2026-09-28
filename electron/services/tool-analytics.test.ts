import { describe, expect, it } from 'vitest'
import { classifyToolResult, validateToolArguments } from './tool-analytics'

describe('validateToolArguments', () => {
  it('rejects invalid JSON', () => {
    const result = validateToolArguments('read_file', '{bad', 'agent')
    expect(result.ok).toBe(false)
    expect(result.issues).toContain('invalid_arguments_json')
  })

  it('accepts read_files with up to 10 paths', () => {
    const paths = Array.from({ length: 10 }, (_, i) => `src/file${i}.ts`)
    const result = validateToolArguments('read_files', JSON.stringify({ paths }), 'agent')
    expect(result.ok).toBe(true)
  })

  it('rejects read_files with more than 10 paths', () => {
    const paths = Array.from({ length: 11 }, (_, i) => `f${i}.ts`)
    const result = validateToolArguments('read_files', JSON.stringify({ paths }), 'agent')
    expect(result.ok).toBe(false)
  })

  it('rejects read_files with empty path entries', () => {
    const result = validateToolArguments(
      'read_files',
      JSON.stringify({ paths: ['ok.ts', '  '] }),
      'agent'
    )
    expect(result.ok).toBe(false)
    expect(result.issues).toContain('empty_path')
  })

  it('requires query for grep_workspace', () => {
    const result = validateToolArguments('grep_workspace', JSON.stringify({ query: '' }), 'agent')
    expect(result.ok).toBe(false)
    expect(result.issues).toContain('empty_query')
  })

  it('blocks write_file in planner mode', () => {
    const result = validateToolArguments(
      'write_file',
      JSON.stringify({ path: 'a.ts', content: 'x' }),
      'planner'
    )
    expect(result.ok).toBe(false)
    expect(result.issues).toContain('tool_not_allowed_in_mode')
  })

  it('blocks search_replace outside plan files in planner mode', () => {
    const result = validateToolArguments(
      'search_replace',
      JSON.stringify({ path: 'a.ts', old_string: 'x', new_string: 'y' }),
      'planner'
    )
    expect(result.ok).toBe(false)
    expect(result.issues).toContain('tool_not_allowed_in_mode')
  })

  it('allows search_replace on planner plan files', () => {
    const result = validateToolArguments(
      'search_replace',
      JSON.stringify({
        path: '.openrouter/plans/camera.md',
        old_string: 'x',
        new_string: 'y'
      }),
      'planner'
    )
    expect(result.ok).toBe(true)
    const windows = validateToolArguments(
      'search_replace',
      JSON.stringify({
        path: '.openrouter\\plans\\camera.md',
        old_string: 'x',
        new_string: 'y'
      }),
      'planner'
    )
    expect(windows.ok).toBe(true)
    const escaped = validateToolArguments(
      'search_replace',
      JSON.stringify({
        path: '.openrouter/plans/../secret.md',
        old_string: 'x',
        new_string: 'y'
      }),
      'planner'
    )
    expect(escaped.ok).toBe(false)
    expect(escaped.issues).toContain('tool_not_allowed_in_mode')
  })

  it('allows grep_workspace in planner mode', () => {
    const result = validateToolArguments(
      'grep_workspace',
      JSON.stringify({ query: 'className' }),
      'planner'
    )
    expect(result.ok).toBe(true)
  })

  it('allows read_files in ask mode and blocks writes', () => {
    const read = validateToolArguments('read_files', JSON.stringify({ paths: ['a.ts'] }), 'ask')
    expect(read.ok).toBe(true)
    const write = validateToolArguments(
      'write_file',
      JSON.stringify({ path: 'a.ts', content: 'x' }),
      'ask'
    )
    expect(write.ok).toBe(false)
    expect(write.issues).toContain('tool_not_allowed_in_mode')
    const terminal = validateToolArguments('run_terminal', JSON.stringify({ command: 'ls' }), 'ask')
    expect(terminal.ok).toBe(false)
    const mcpRead = validateToolArguments('mcp__srv__read_file', JSON.stringify({ path: 'a.ts' }), 'ask')
    expect(mcpRead.issues).toContain('tool_not_allowed_in_mode')
    const plannerMcpWrite = validateToolArguments(
      'mcp__srv__write_file',
      JSON.stringify({ path: 'a.ts' }),
      'planner'
    )
    expect(plannerMcpWrite.issues).toContain('tool_not_allowed_in_mode')
    const plannerMcpRead = validateToolArguments(
      'mcp__srv__read_file',
      JSON.stringify({ path: 'a.ts' }),
      'planner'
    )
    expect(plannerMcpRead.issues).not.toContain('tool_not_allowed_in_mode')
  })

  it('accepts read_project_memory without required args', () => {
    const result = validateToolArguments('read_project_memory', JSON.stringify({}), 'agent')
    expect(result.ok).toBe(true)
  })

  it('accepts update_project_memory append', () => {
    const result = validateToolArguments(
      'update_project_memory',
      JSON.stringify({ action: 'append', content: 'Use Vitest' }),
      'agent'
    )
    expect(result.ok).toBe(true)
  })

  it('blocks update_project_memory in planner mode', () => {
    const result = validateToolArguments(
      'update_project_memory',
      JSON.stringify({ action: 'append', content: 'note' }),
      'planner'
    )
    expect(result.ok).toBe(false)
    expect(result.issues).toContain('tool_not_allowed_in_mode')
  })

  it('accepts create_task_checklist in agent mode', () => {
    const result = validateToolArguments(
      'create_task_checklist',
      JSON.stringify({ steps: ['Step one', 'Step two', 'Step three'] }),
      'agent'
    )
    expect(result.ok).toBe(true)
  })

  it('accepts update_task_checklist in agent mode', () => {
    const result = validateToolArguments(
      'update_task_checklist',
      JSON.stringify({ step: 1, status: 'done' }),
      'agent'
    )
    expect(result.ok).toBe(true)
  })
})

describe('classifyToolResult', () => {
  it('classifies grep_workspace no results', () => {
    const { outcome, issues } = classifyToolResult('grep_workspace', 'No matches found')
    expect(outcome).toBe('success')
    expect(issues).toContain('no_results')
  })

  it('classifies blocked shell grep as terminal_blocked', () => {
    const { issues } = classifyToolResult(
      'run_terminal',
      'Error: Blocked: do not use the shell to search or grep source files.'
    )
    expect(issues).toContain('terminal_blocked')
  })

  it('classifies search_replace not found', () => {
    const { outcome, issues } = classifyToolResult(
      'search_replace',
      'Error: old_string not found in file.'
    )
    expect(outcome).toBe('error')
    expect(issues).toContain('search_replace_not_found')
  })
})
