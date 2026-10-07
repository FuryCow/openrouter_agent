import { describe, expect, it } from 'vitest'
import {
  buildDistillUserPrompt,
  parseDistillResponse,
  getDistillSystemPrompt
} from './skill-distill'
import type { ApiChatMessage, AgentRunAnalytics } from '../../types'

const session: ApiChatMessage[] = [
  { role: 'user', content: 'Add a dark mode toggle to the settings page' },
  {
    role: 'assistant',
    content: null,
    tool_calls: [
      {
        id: 'c1',
        type: 'function',
        function: {
          name: 'grep_workspace',
          arguments: JSON.stringify({ query: 'theme', limit: 5 })
        }
      }
    ]
  },
  {
    role: 'tool',
    tool_call_id: 'c1',
    name: 'grep_workspace',
    content: `${'x'.repeat(500)}`
  },
  {
    role: 'assistant',
    content: 'Found the theme tokens, now updating the component.',
    tool_calls: [
      {
        id: 'c2',
        type: 'function',
        function: {
          name: 'search_replace',
          arguments: JSON.stringify({ path: 'src/App.tsx', old_string: 'light', new_string: 'dark' })
        }
      }
    ]
  },
  { role: 'tool', tool_call_id: 'c2', name: 'search_replace', content: 'Successfully replaced 1 occurrence(s)' },
  { role: 'assistant', content: 'Done. Dark mode toggle added and verified with npm test.' }
]

const analytics: AgentRunAnalytics = {
  runId: 'r1',
  mode: 'agent',
  model: 'test/model',
  userMessagePreview: 'dark mode',
  startedAt: '2026-01-01T00:00:00Z',
  endedAt: '2026-01-01T00:01:00Z',
  status: 'completed',
  iterations: 3,
  maxIterations: Number.POSITIVE_INFINITY,
  toolCalls: [
    {
      id: 'a1',
      toolCallId: 'c1',
      iteration: 1,
      name: 'grep_workspace',
      argumentsRaw: '{}',
      argumentsParsed: {},
      startedAt: '2026-01-01T00:00:01Z',
      durationMs: 10,
      outcome: 'success',
      issues: [],
      resultPreview: 'theme',
      resultLength: 500
    },
    {
      id: 'a2',
      toolCallId: 'c2',
      iteration: 2,
      name: 'search_replace',
      argumentsRaw: '{}',
      argumentsParsed: {},
      startedAt: '2026-01-01T00:00:30Z',
      durationMs: 12,
      outcome: 'success',
      issues: [],
      resultPreview: 'ok',
      resultLength: 30
    }
  ],
  summary: {
    totalTools: 2,
    success: 2,
    errors: 0,
    invalidArgs: 0,
    issueCounts: {},
    byTool: {}
  }
}

describe('buildDistillUserPrompt', () => {
  it('includes the trajectory, tool names, and final answer', () => {
    const prompt = buildDistillUserPrompt({ apiMessages: session, finalContent: 'Done.', runAnalytics: analytics })
    expect(prompt).toContain('user: Add a dark mode toggle')
    expect(prompt).toContain('tool grep_workspace')
    expect(prompt).toContain('tool search_replace')
    expect(prompt).toContain('path=src/App.tsx')
    expect(prompt).toContain('Final answer to the user: Done.')
    expect(prompt).toContain('Run summary: mode=agent')
    expect(prompt).toContain('grep_workspace, search_replace')
  })

  it('collapses long tool results to a preview', () => {
    const prompt = buildDistillUserPrompt({ apiMessages: session, finalContent: 'Done.' })
    expect(prompt).toContain('[+340 chars]')
    expect(prompt).not.toContain('x'.repeat(200))
  })

  it('stays within a sane budget for large sessions', () => {
    const big: ApiChatMessage[] = Array.from({ length: 60 }, (_, i) => ({
      role: 'tool' as const,
      tool_call_id: `t${i}`,
      name: 'read_files',
      content: 'y'.repeat(20000)
    }))
    const prompt = buildDistillUserPrompt({ apiMessages: big, finalContent: 'ok' })
    expect(prompt.length).toBeLessThan(60 * (160 + 40))
  })
})

describe('parseDistillResponse', () => {
  it('parses a valid skill response', () => {
    const draft = parseDistillResponse(
      '---\nname: dark-mode-toggle\ndescription: How to add a theme toggle. Use when touching src/settings.\n---\n1. Find tokens\n2. Update component'
    )
    expect(draft).toEqual({
      name: 'dark-mode-toggle',
      description: 'How to add a theme toggle. Use when touching src/settings.',
      body: '1. Find tokens\n2. Update component'
    })
  })

  it('strips a wrapping code fence', () => {
    const draft = parseDistillResponse(
      '```markdown\n---\nname: fenced\ndescription: A fenced skill.\n---\nBody here\n```'
    )
    expect(draft?.name).toBe('fenced')
    expect(draft?.body).toBe('Body here')
  })

  it('returns null when frontmatter is missing', () => {
    expect(parseDistillResponse('# Just markdown')).toBeNull()
  })

  it('returns null when required fields are empty', () => {
    expect(parseDistillResponse('---\nname: \ndescription: x\n---\nbody')).toBeNull()
    expect(parseDistillResponse('---\nname: ok\ndescription:\n---\nbody')).toBeNull()
    expect(parseDistillResponse('---\nname: ok\ndescription: d\n---\n')).toBeNull()
  })

  it('exposes the distill system prompt for the LLM call', () => {
    expect(getDistillSystemPrompt()).toContain('frontmatter')
  })
})
