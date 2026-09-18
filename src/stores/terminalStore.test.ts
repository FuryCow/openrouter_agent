import { beforeEach, describe, expect, it } from 'vitest'
import { useTerminalStore } from '@/stores/terminalStore'

describe('terminalStore ensureInitialTab', () => {
  beforeEach(() => {
    useTerminalStore.setState({ tabs: [], activeTabId: null })
  })

  it('creates the first tab with the given cwd', () => {
    useTerminalStore.getState().ensureInitialTab('F:\\pets\\step_to_award')

    const { tabs, activeTabId } = useTerminalStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0]?.cwd).toBe('F:\\pets\\step_to_award')
    expect(activeTabId).toBe(tabs[0]?.id)
  })

  it('updates a placeholder tab when workspace cwd loads later', () => {
    useTerminalStore.getState().ensureInitialTab(null)
    const tabId = useTerminalStore.getState().tabs[0]?.id

    useTerminalStore.getState().ensureInitialTab('F:\\pets\\step_to_award')

    const { tabs, activeTabId } = useTerminalStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0]?.id).toBe(tabId)
    expect(tabs[0]?.cwd).toBe('F:\\pets\\step_to_award')
    expect(activeTabId).toBe(tabId)
  })

  it('does not overwrite an existing tab cwd', () => {
    useTerminalStore.getState().ensureInitialTab('F:\\other\\project')
    useTerminalStore.getState().ensureInitialTab('F:\\pets\\step_to_award')

    expect(useTerminalStore.getState().tabs[0]?.cwd).toBe('F:\\other\\project')
  })
})
