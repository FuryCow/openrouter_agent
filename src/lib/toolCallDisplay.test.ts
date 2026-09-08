import { describe, expect, it } from 'vitest'
import { buildToolArgsView, buildToolResultView } from './toolCallDisplay'

describe('buildToolArgsView', () => {
  it('formats read_files paths', () => {
    const view = buildToolArgsView('read_files', JSON.stringify({ paths: ['src/a.ts', 'src/b.ts'] }))
    expect(view).toEqual({ kind: 'paths', paths: ['src/a.ts', 'src/b.ts'] })
  })

  it('formats search_replace as structured change', () => {
    const view = buildToolArgsView(
      'search_replace',
      JSON.stringify({ path: 'src/a.ts', old_string: 'foo', new_string: 'bar' })
    )
    expect(view.kind).toBe('search-replace')
    if (view.kind === 'search-replace') {
      expect(view.path).toBe('src/a.ts')
      expect(view.oldString).toBe('foo')
      expect(view.newString).toBe('bar')
    }
  })

  it('formats terminal command', () => {
    const view = buildToolArgsView('run_terminal', JSON.stringify({ command: 'npm test' }))
    expect(view).toEqual({ kind: 'command', command: 'npm test' })
  })

  it('formats create_task_checklist object steps', () => {
    const view = buildToolArgsView(
      'create_task_checklist',
      JSON.stringify({
        steps: [{ text: 'Read files' }, { description: 'Apply edits' }]
      })
    )
    expect(view).toEqual({
      kind: 'generic',
      fields: [
        { key: '1', value: 'Read files' },
        { key: '2', value: 'Apply edits' }
      ]
    })
  })
})

describe('buildToolResultView', () => {
  it('parses grep hits', () => {
    const view = buildToolResultView('grep_workspace', 'src/a.ts:12: const foo = 1')
    expect(view.kind).toBe('grep-hits')
    if (view.kind === 'grep-hits') {
      expect(view.hits[0]).toEqual({ file: 'src/a.ts', line: 12, content: 'const foo = 1' })
    }
  })

  it('parses codebase search hits', () => {
    const view = buildToolResultView(
      'codebase_search',
      'src/a.ts:10-12 [hybrid] handleClick snippet text'
    )
    expect(view.kind).toBe('search-hits')
  })

  it('parses read_files sections', () => {
    const view = buildToolResultView('read_files', '=== src/a.ts ===\nexport const x = 1')
    expect(view.kind).toBe('file-sections')
  })
})
