import { describe, expect, it } from 'vitest'
import { chunkFileContent } from './chunker'

describe('chunkFileContent', () => {
  it('creates sliding window chunks for plain files', () => {
    const lines = Array.from({ length: 80 }, (_, i) => `line ${i + 1}`)
    const chunks = chunkFileContent(lines.join('\n'))
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].startLine).toBe(1)
  })

  it('prefers symbol boundaries when provided', () => {
    const content = 'function foo() {\n  return 1\n}\n'
    const chunks = chunkFileContent(content, [{ name: 'foo', startLine: 1, endLine: 3 }])
    expect(chunks).toHaveLength(1)
    expect(chunks[0].symbolName).toBe('foo')
  })
})
