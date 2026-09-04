import { useEffect, useRef } from 'react'
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle
} from 'react-resizable-panels'
import { TitleBar } from './components/layout/TitleBar'
import { StatusBar } from './components/layout/StatusBar'
import { FileExplorer } from './components/explorer/FileExplorer'
import { CodeEditor } from './components/editor/CodeEditor'
import { ChatPanel } from './components/chat/ChatPanel'
import { TerminalPanel } from './components/terminal/TerminalPanel'
import { SettingsModal } from './components/settings/SettingsModal'
import { useSettingsStore } from './stores/settingsStore'
import { useFileStore } from './stores/fileStore'
import { useToastStore } from './stores/toastStore'
import { ToolAnalyticsPanel } from './components/debug/ToolAnalyticsPanel'
import { ApprovalDialog } from './components/chat/ApprovalDialog'
import { useChatPersistence } from './hooks/useChatPersistence'
import { useIndexStore } from './stores/indexStore'
import { Toaster } from './components/ui/toaster'

function ResizeHandle({ direction }: { direction: 'horizontal' | 'vertical' }): React.ReactElement {
  return (
    <PanelResizeHandle
      className={
        direction === 'horizontal'
          ? 'w-px bg-white/5 hover:bg-indigo-500/30 transition-colors data-[resize-handle-active]:bg-indigo-500/50'
          : 'h-px bg-white/5 hover:bg-indigo-500/30 transition-colors data-[resize-handle-active]:bg-indigo-500/50'
      }
    />
  )
}

export default function App(): React.ReactElement {
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const terminalOpen = useSettingsStore((s) => s.terminalOpen)
  const activeTabPath = useFileStore((s) => s.activeTabPath)
  const tabs = useFileStore((s) => s.tabs)
  const markTabSaved = useFileStore((s) => s.markTabSaved)
  const reloadCleanTabsFromDisk = useFileStore((s) => s.reloadCleanTabsFromDisk)
  const editorPanelRef = useRef<ImperativePanelHandle>(null)
  const terminalPanelRef = useRef<ImperativePanelHandle>(null)

  useEffect(() => {
    if (terminalOpen) {
      terminalPanelRef.current?.resize(35)
    } else {
      terminalPanelRef.current?.resize(4)
    }
  }, [terminalOpen])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useChatPersistence()

  useEffect(() => {
    return useIndexStore.getState().subscribe()
  }, [])

  useEffect(() => {
    return window.api.fs.onWorkspaceChanged(() => {
      void reloadCleanTabsFromDisk()
    })
  }, [reloadCleanTabsFromDisk])

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent): Promise<void> => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        const tab = tabs.find((t) => t.path === activeTabPath)
        if (tab) {
          await window.api.fs.writeFile(tab.path, tab.content)
          markTabSaved(tab.path)
          useToastStore.getState().addToast(`Saved ${tab.path.split(/[/\\]/).pop()}`, 'success')
        }
      }
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        useSettingsStore.getState().setTerminalOpen(
          !useSettingsStore.getState().terminalOpen
        )
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        useSettingsStore.getState().setSettingsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabPath, tabs, markTabSaved])

  return (
    <div className="flex h-full flex-col">
      <TitleBar />

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={18} minSize={12} maxSize={30}>
            <FileExplorer />
          </Panel>

          <ResizeHandle direction="horizontal" />

          <Panel defaultSize={52} minSize={30} className="min-h-0">
            <PanelGroup direction="vertical">
              <Panel
                ref={editorPanelRef}
                defaultSize={terminalOpen ? 65 : 96}
                minSize={30}
                className="min-h-0"
              >
                <div className="h-full min-h-0 overflow-hidden">
                  <CodeEditor />
                </div>
              </Panel>

              <ResizeHandle direction="vertical" />

              <Panel
                ref={terminalPanelRef}
                defaultSize={terminalOpen ? 35 : 4}
                minSize={terminalOpen ? 15 : 4}
                maxSize={terminalOpen ? 60 : 4}
                className="min-h-0"
              >
                <div className="h-full min-h-0 overflow-hidden">
                  <TerminalPanel />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <ResizeHandle direction="horizontal" />

          <Panel defaultSize={30} minSize={20} maxSize={45}>
            <ChatPanel />
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar />
      <SettingsModal />
      <Toaster />
      <ToolAnalyticsPanel />
      <ApprovalDialog />
    </div>
  )
}
