import { describe, expect, it } from 'vitest'
import { normalizeChecklistStepItem, normalizeChecklistSteps } from './checklist-steps'

describe('normalizeChecklistSteps', () => {
  it('passes through string steps', () => {
    expect(normalizeChecklistSteps([' Read files ', 'Apply edits'])).toEqual([
      'Read files',
      'Apply edits'
    ])
  })

  it('extracts text from object steps', () => {
    expect(
      normalizeChecklistSteps([
        { text: 'Add burger menu' },
        { description: 'Verify with playwright' },
        { step: 'Run tests' }
      ])
    ).toEqual(['Add burger menu', 'Verify with playwright', 'Run tests'])
  })

  it('uses first string property as fallback', () => {
    expect(normalizeChecklistSteps([{ label: 'Inspect layout' }])).toEqual(['Inspect layout'])
  })

  it('drops empty or unrecognizable items', () => {
    expect(normalizeChecklistSteps(['', {}, { text: '  ' }, null, { text: 'Keep me' }])).toEqual([
      'Keep me'
    ])
  })
})

describe('normalizeChecklistStepItem', () => {
  it('coerces numbers and booleans', () => {
    expect(normalizeChecklistStepItem(3)).toBe('3')
    expect(normalizeChecklistStepItem(true)).toBe('true')
  })
})
