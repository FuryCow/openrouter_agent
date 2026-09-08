import { describe, expect, it } from 'vitest'
import { parsePlannerPlan } from './parsePlannerPlan'

describe('parsePlannerPlan', () => {
  it('extracts goal, steps, files, and verification sections', () => {
    const plan = parsePlannerPlan(`## Goal
Add workspace chat isolation

## Steps
1. Update chat persistence paths
2. Wire reload on workspace switch in \`src/hooks/useChatPersistence.ts\`

## Files to touch
- electron/services/chat-persistence.ts
- src/hooks/useChatPersistence.ts

## Testing
- Run unit tests for migration
- npm test`)

    expect(plan.goal).toContain('workspace chat isolation')
    expect(plan.steps).toHaveLength(2)
    expect(plan.files).toContain('electron/services/chat-persistence.ts')
    expect(plan.files).toContain('src/hooks/useChatPersistence.ts')
    expect(plan.verificationSteps.some((step) => step.includes('unit tests'))).toBe(true)
  })

  it('falls back to numbered steps anywhere in the plan', () => {
    const plan = parsePlannerPlan(`Plan:
1. Read target files
2. Apply patch to \`src/app.ts\``)

    expect(plan.steps).toHaveLength(2)
    expect(plan.files).toContain('src/app.ts')
  })
})
