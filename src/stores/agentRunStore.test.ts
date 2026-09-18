import { describe, expect, it } from 'vitest'
import { useAgentRunStore } from './agentRunStore'

describe('agentRunStore', () => {
  it('ignores non-array checklist payloads', () => {
    useAgentRunStore.getState().setChecklist([{ id: '1', title: 'Step', status: 'pending' }])
    useAgentRunStore.getState().setChecklist('bad' as unknown as [])
    expect(useAgentRunStore.getState().checklist).toBeNull()
  })

  it('resets run UI state', () => {
    useAgentRunStore.getState().setRunStatus('running')
    useAgentRunStore.getState().setLastTerminalOutput('output')
    useAgentRunStore.getState().resetRunUi()
    expect(useAgentRunStore.getState().runStatus).toBeNull()
    expect(useAgentRunStore.getState().lastTerminalOutput).toBeNull()
  })
})
