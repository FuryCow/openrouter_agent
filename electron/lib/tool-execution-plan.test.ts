import { describe, expect, it } from 'vitest'
import type { ToolCall } from '../services/openrouter'
import { buildExecutionWaves, resolveWorkspacePath } from './tool-execution-plan'

function tool(name: string, args: Record<string, unknown>, id = '1'): ToolCall {
  return {
    id,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(args)
    }
  }
}

describe('buildExecutionWaves', () => {
  const cwd = '/proj'

  it('runs patches on different files in one parallel wave', () => {
    const calls = [
      tool('search_replace', { path: 'a.html', old_string: 'x', new_string: 'y' }, '1'),
      tool('search_replace', { path: 'b.html', old_string: 'x', new_string: 'y' }, '2')
    ]
    expect(buildExecutionWaves(calls, cwd)).toEqual([calls])
  })

  it('sequentializes two edits to the same file', () => {
    const first = tool('search_replace', { path: 'a.html', old_string: 'x', new_string: 'y' }, '1')
    const second = tool('search_replace', { path: 'a.html', old_string: 'y', new_string: 'z' }, '2')
    expect(buildExecutionWaves([first, second], cwd)).toEqual([[first], [second]])
  })

  it('isolates run_terminal in its own wave', () => {
    const patch = tool('search_replace', { path: 'a.html', old_string: 'x', new_string: 'y' }, '1')
    const term = tool('run_terminal', { command: 'npm test' }, '2')
    const patch2 = tool('write_file', { path: 'b.html', content: 'hi' }, '3')
    expect(buildExecutionWaves([patch, term, patch2], cwd)).toEqual([[patch], [term], [patch2]])
  })

  it('allows parallel read-only tools without path conflicts', () => {
    const calls = [
      tool('grep_workspace', { query: 'foo' }, '1'),
      tool('read_file', { path: 'a.html' }, '2'),
      tool('read_file', { path: 'b.html' }, '3')
    ]
    expect(buildExecutionWaves(calls, cwd)).toEqual([calls])
  })

  it('sequentializes read_files overlap with patch on same path', () => {
    const batch = tool('read_files', { paths: ['a.html', 'b.html'] }, '1')
    const patch = tool('search_replace', { path: 'a.html', old_string: 'x', new_string: 'y' }, '2')
    expect(buildExecutionWaves([batch, patch], cwd)).toEqual([[batch], [patch]])
  })
})

describe('resolveWorkspacePath', () => {
  it('joins relative paths to cwd', () => {
    expect(resolveWorkspacePath('src/a.ts', '/proj')).toMatch(/src[\\/]a\.ts$/)
  })
})
