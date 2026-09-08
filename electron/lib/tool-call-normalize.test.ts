import { describe, expect, it } from 'vitest'
import { normalizeToolCall } from './tool-call-normalize'

describe('normalizeToolCall', () => {
  it('maps grep with pattern/path to grep_workspace', () => {
    const { name, args } = normalizeToolCall('grep', { pattern: 'className', path: 'src' })
    expect(name).toBe('grep_workspace')
    expect(args.query).toBe('className')
    expect(args.root).toBe('src')
  })

  it('ignores path "." for grep alias', () => {
    const { name, args } = normalizeToolCall('grep', { pattern: 'foo', path: '.' })
    expect(name).toBe('grep_workspace')
    expect(args.query).toBe('foo')
    expect(args.root).toBeUndefined()
  })

  it('passes through other tools unchanged', () => {
    const { name, args } = normalizeToolCall('read_files', { paths: ['a.ts'] })
    expect(name).toBe('read_files')
    expect(args.paths).toEqual(['a.ts'])
  })

  it('normalizes create_task_checklist object steps to strings', () => {
    const { name, args } = normalizeToolCall('create_task_checklist', {
      steps: [{ text: 'Step one' }, { description: 'Step two' }]
    })
    expect(name).toBe('create_task_checklist')
    expect(args.steps).toEqual(['Step one', 'Step two'])
  })
})
