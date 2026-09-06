import { describe, expect, it, beforeEach } from 'vitest'
import { useFileStore, type EditorTab } from '@/stores/fileStore'

function setTabs(tabs: EditorTab[], activeTabPath: string | null): void {
  useFileStore.setState({ tabs, activeTabPath })
}

describe('fileStore tab closing', () => {
  beforeEach(() => {
    useFileStore.setState({
      tabs: [],
      activeTabPath: null,
      workingDirectory: null,
      pendingEditorReveal: null
    })
  })

  it('activates the tab to the right when closing the active tab', () => {
    setTabs(
      [
        { path: 'a.ts', content: '', language: 'typescript', isDirty: false },
        { path: 'b.ts', content: '', language: 'typescript', isDirty: false },
        { path: 'c.ts', content: '', language: 'typescript', isDirty: false }
      ],
      'b.ts'
    )

    useFileStore.getState().closeTab('b.ts')

    expect(useFileStore.getState().tabs.map((tab) => tab.path)).toEqual(['a.ts', 'c.ts'])
    expect(useFileStore.getState().activeTabPath).toBe('c.ts')
  })

  it('closes tabs to the left of the selected tab', () => {
    setTabs(
      [
        { path: 'a.ts', content: '', language: 'typescript', isDirty: false },
        { path: 'b.ts', content: '', language: 'typescript', isDirty: false },
        { path: 'c.ts', content: '', language: 'typescript', isDirty: false }
      ],
      'b.ts'
    )

    useFileStore.getState().closeTabsToLeftOf('b.ts')

    expect(useFileStore.getState().tabs.map((tab) => tab.path)).toEqual(['b.ts', 'c.ts'])
    expect(useFileStore.getState().activeTabPath).toBe('b.ts')
  })

  it('closes other tabs and keeps the selected one active', () => {
    setTabs(
      [
        { path: 'a.ts', content: '', language: 'typescript', isDirty: false },
        { path: 'b.ts', content: '', language: 'typescript', isDirty: false },
        { path: 'c.ts', content: '', language: 'typescript', isDirty: false }
      ],
      'a.ts'
    )

    useFileStore.getState().closeOtherTabs('b.ts')

    expect(useFileStore.getState().tabs.map((tab) => tab.path)).toEqual(['b.ts'])
    expect(useFileStore.getState().activeTabPath).toBe('b.ts')
  })
})
