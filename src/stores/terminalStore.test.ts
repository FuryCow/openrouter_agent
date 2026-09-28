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

  it('moves open tabs into the folder that was just opened', () => {
    useTerminalStore.getState().ensureInitialTab('F:\\pets\\step_to_award')
    useTerminalStore.getState().addTab('F:\\pets\\step_to_award')
    useTerminalStore.getState().renameFromFirstCommand(
      useTerminalStore.getState().tabs[0]?.id ?? '',
      'flutter test'
    )
    const ids = useTerminalStore.getState().tabs.map((tab) => tab.id)

    useTerminalStore.getState().ensureInitialTab('F:\\UnityHub\\UnityProjects\\My project')

    const { tabs } = useTerminalStore.getState()
    expect(tabs.map((tab) => tab.id)).toEqual(ids)
    expect(tabs.every((tab) => tab.cwd === 'F:\\UnityHub\\UnityProjects\\My project')).toBe(true)
    expect(tabs.every((tab) => tab.title === 'Terminal' && !tab.customTitle)).toBe(true)
  })
})
