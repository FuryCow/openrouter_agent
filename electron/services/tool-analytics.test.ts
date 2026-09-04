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

  it('blocks mutating tools in planner mode', () => {
    const result = validateToolArguments(
      'search_replace',
      JSON.stringify({ path: 'a.ts', old_string: 'x', new_string: 'y' }),
      'planner'
    )
    expect(result.ok).toBe(false)
    expect(result.issues).toContain('tool_not_allowed_in_mode')
  })

  it('allows grep_workspace in planner mode', () => {
    const result = validateToolArguments(
      'grep_workspace',
      JSON.stringify({ query: 'className' }),
      'planner'
    )
    expect(result.ok).toBe(true)
  })

  it('blocks all tools in ask mode', () => {
    const result = validateToolArguments('read_files', JSON.stringify({ paths: ['a.ts'] }), 'ask')
    expect(result.ok).toBe(false)
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
