import { describe, expect, it } from 'vitest'
import { prepareImplementPlan } from './implementPlan'
import type { ChatMessage } from '../types'

const plan = [
  '# Goal',
  'Ship the feature.',
  '',
  '## Steps',
  '1. Update `src/app.ts`',
  '2. Run tests',
  '',
  '## Files to touch',
  '- `src/app.ts`',
  '',
  '## Verification',
  '- `npm test` passes'
].join('\n')

const plannerMessage = (content: string): ChatMessage =>
  ({ id: 'm1', role: 'user', mode: 'planner', content }) as ChatMessage

describe('prepareImplementPlan', () => {
  it('is not ready while streaming', () => {
    const result = prepareImplementPlan({ isStreaming: true, messages: [], planContent: plan })
    expect(result.ready).toBe(false)
  })

  it('builds the prompt and parses the approved plan', () => {
    const result = prepareImplementPlan({
      isStreaming: false,
      messages: [plannerMessage('Build a widget')],
      planContent: plan
    })
    expect(result.ready).toBe(true)
    if (!result.ready) return
    expect(result.prompt).toContain('Original user task:')
    expect(result.prompt).toContain('Build a widget')
    expect(result.prompt).toContain('Implement according to the plan below')
    expect(result.prompt).toContain(plan)
    expect(result.approvedPlan.goal).toBe('Ship the feature.')
    expect(result.approvedPlan.steps.map((step) => step.text)).toEqual([
      'Update `src/app.ts`',
      'Run tests'
    ])
    expect(result.approvedPlan.files).toContain('src/app.ts')
    expect(result.approvedPlan.verificationSteps).toContain('`npm test` passes')
  })

  it('omits the task line when no planner user message exists', () => {
    const result = prepareImplementPlan({
      isStreaming: false,
      messages: [{ id: 'm2', role: 'user', mode: 'agent', content: 'hi' } as ChatMessage],
      planContent: plan
    })
    expect(result.ready).toBe(true)
    if (!result.ready) return
    expect(result.prompt).not.toContain('Original user task:')
    expect(result.prompt).toContain('Implement according to the plan below')
  })

  it('uses the latest planner user message as the task', () => {
    const result = prepareImplementPlan({
      isStreaming: false,
      messages: [
        plannerMessage('first task'),
        plannerMessage('second task')
      ],
      planContent: plan
    })
    expect(result.ready).toBe(true)
    if (!result.ready) return
    expect(result.prompt).toContain('second task')
    expect(result.prompt).not.toContain('first task')
  })
})
