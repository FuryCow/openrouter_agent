import { describe, expect, it } from 'vitest'
import {
  clampReasoningEffortForModel,
  getReasoningEffortSteps,
  toOpenRouterReasoningBody
} from './reasoning-effort'

describe('reasoning effort', () => {
  it('leaves auto off the request and sends an explicit level', () => {
    expect(toOpenRouterReasoningBody('auto')).toEqual({})
    expect(toOpenRouterReasoningBody('high')).toEqual({ reasoning: { effort: 'high' } })
    expect(toOpenRouterReasoningBody('none')).toEqual({ reasoning: { effort: 'none' } })
  })

  it('hides Off when the model requires reasoning', () => {
    const context = {
      mandatory: true,
      defaultEffort: 'medium',
      supportedEfforts: ['low', 'medium', 'high', 'xhigh']
    }
    expect(getReasoningEffortSteps(context)).toEqual(['auto', 'low', 'medium', 'high', 'xhigh'])
    expect(clampReasoningEffortForModel('none', context)).toBe('medium')
    expect(toOpenRouterReasoningBody('xhigh', context)).toEqual({ reasoning: { effort: 'xhigh' } })
    expect(toOpenRouterReasoningBody('max', context)).toEqual({ reasoning: { effort: 'xhigh' } })
  })

  it('keeps Extra high and Max as separate steps when the model lists both', () => {
    const context = { supportedEfforts: ['low', 'medium', 'high', 'xhigh', 'max'] }
    expect(getReasoningEffortSteps(context)).toEqual([
      'auto',
      'none',
      'low',
      'medium',
      'high',
      'xhigh',
      'max'
    ])
    expect(toOpenRouterReasoningBody('xhigh', context)).toEqual({ reasoning: { effort: 'xhigh' } })
    expect(toOpenRouterReasoningBody('max', context)).toEqual({ reasoning: { effort: 'max' } })
  })

  it('moves an unsupported level to the nearest one the model lists', () => {
    const context = { supportedEfforts: ['low', 'high'] }
    expect(clampReasoningEffortForModel('medium', context)).toBe('high')
    expect(toOpenRouterReasoningBody('medium', context)).toEqual({ reasoning: { effort: 'high' } })
  })
})
