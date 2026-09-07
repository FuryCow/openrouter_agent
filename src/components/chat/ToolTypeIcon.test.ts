import { describe, expect, it } from 'vitest'
import { resolveToolIconKind } from './ToolTypeIcon'

describe('resolveToolIconKind', () => {
  it('maps built-in tools to distinct icon kinds', () => {
    expect(resolveToolIconKind('read_files')).toBe('read')
    expect(resolveToolIconKind('write_file')).toBe('write')
    expect(resolveToolIconKind('search_replace')).toBe('patch')
    expect(resolveToolIconKind('grep_workspace')).toBe('grep')
    expect(resolveToolIconKind('run_terminal')).toBe('terminal')
    expect(resolveToolIconKind('read_project_memory')).toBe('memory-read')
    expect(resolveToolIconKind('update_project_memory')).toBe('memory-write')
  })

  it('maps MCP tools to mcp icon kind', () => {
    expect(resolveToolIconKind('mcp__memory-graph__graph_record_session')).toBe('mcp')
  })
})
