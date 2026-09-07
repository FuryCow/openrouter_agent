import { describe, expect, it } from 'vitest'
import { buildResolveInChatPrompt } from './resolveInChatPrompt'

describe('buildResolveInChatPrompt', () => {
  it('includes file path, line context, and error message', () => {
    const prompt = buildResolveInChatPrompt({
      filePath: 'src/gmail.ts',
      line: 112,
      column: 18,
      message: "Cannot find name 'Buffer'.",
      lineText: '  if (d) text = Buffer.from(d, "base64").toString("utf8");'
    })

    expect(prompt).toContain('src/gmail.ts')
    expect(prompt).toContain('line 112, column 18')
    expect(prompt).toContain("Cannot find name 'Buffer'.")
    expect(prompt).toContain('Buffer.from')
  })
})
