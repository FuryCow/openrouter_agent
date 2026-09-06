import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { X } from 'lucide-react'
import { useFileStore, type EditorRevealRequest } from '@/stores/fileStore'
import { FileIcon } from '@/components/ui/FileIcon'
import { getFileName, getRelativePath, truncateRelativePath, isMarkdownPath, cn } from '@/lib/utils'
import { MarkdownPreview } from '@/components/editor/MarkdownPreview'
import { MarkdownViewToggle } from '@/components/editor/MarkdownViewToggle'
import {
  ExplorerContextMenu,
  type ContextMenuItem
} from '@/components/explorer/ExplorerContextMenu'
import { useEditorStore } from '@/stores/editorStore'
import { buildEditorFileStats } from '@/lib/editorFileStats'

interface TabContextMenuState {
  x: number
  y: number
  tabPath: string
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function pathsMatch(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b)
}

function applyEditorReveal(
  editorInstance: editor.IStandaloneCodeEditor,
  monaco: typeof import('monaco-editor'),
  request: EditorRevealRequest,
  decorationIdsRef: React.MutableRefObject<string[]>
): void {
  editorInstance.revealLineInCenter(request.scrollToLine)

  if (decorationIdsRef.current.length > 0) {
    editorInstance.deltaDecorations(decorationIdsRef.current, [])
  }

  decorationIdsRef.current = editorInstance.deltaDecorations(
    [],
    request.highlightRanges.map((range) => ({
      range: new monaco.Range(range.startLine, 1, range.endLine, 1),
      options: {
        isWholeLine: true,
        className: 'file-diff-highlight-line',
        linesDecorationsClassName: 'file-diff-highlight-gutter'
      }
    }))
  )
}

export function CodeEditor(): React.ReactElement {
  const tabs = useFileStore((s) => s.tabs)
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const activeTabPath = useFileStore((s) => s.activeTabPath)
  const pendingEditorReveal = useFileStore((s) => s.pendingEditorReveal)
  const setActiveTab = useFileStore((s) => s.setActiveTab)
  const setTabViewMode = useFileStore((s) => s.setTabViewMode)
  const closeTab = useFileStore((s) => s.closeTab)
  const closeTabsToLeftOf = useFileStore((s) => s.closeTabsToLeftOf)
  const closeTabsToRightOf = useFileStore((s) => s.closeTabsToRightOf)
  const closeOtherTabs = useFileStore((s) => s.closeOtherTabs)
  const updateTabContent = useFileStore((s) => s.updateTabContent)
  const markTabSaved = useFileStore((s) => s.markTabSaved)
  const clearEditorReveal = useFileStore((s) => s.clearEditorReveal)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoApiRef = useRef<typeof import('monaco-editor') | null>(null)
  const diffDecorationIdsRef = useRef<string[]>([])
  const revealClearTimerRef = useRef<number | null>(null)
  const editorStatsDisposablesRef = useRef<Array<{ dispose: () => void }>>([])
  const [tabMenu, setTabMenu] = useState<TabContextMenuState | null>(null)
  const setEditorStats = useEditorStore((s) => s.setStats)

  const activeTab = tabs.find((t) => t.path === activeTabPath)
  const isMarkdownTab = activeTab ? isMarkdownPath(activeTab.path) : false
  const markdownViewMode = activeTab?.viewMode ?? 'edit'
  const showMarkdownPreview = isMarkdownTab && markdownViewMode === 'preview'

  const publishEditorStats = useCallback((): void => {
    const state = useFileStore.getState()
    const tab = state.tabs.find((item) => item.path === state.activeTabPath)
    if (!tab) {
      setEditorStats(null)
      return
    }

    const preview = isMarkdownPath(tab.path) && (tab.viewMode ?? 'edit') === 'preview'
    setEditorStats(
      buildEditorFileStats(tab, preview ? null : monacoEditorRef.current, {
        showCursor: !preview
      })
    )
  }, [setEditorStats])

  useEffect(() => {
    publishEditorStats()
  }, [activeTab, activeTab?.content, activeTab?.language, showMarkdownPreview, publishEditorStats])

  useEffect(() => {
    return () => {
      setEditorStats(null)
    }
  }, [setEditorStats])

  const tryApplyPendingReveal = useCallback((): boolean => {
    const editorInstance = monacoEditorRef.current
    const monaco = monacoApiRef.current
    const pending = useFileStore.getState().pendingEditorReveal
    const activePath = useFileStore.getState().activeTabPath

    if (!editorInstance || !monaco || !pending || !activePath) return false
    if (!pathsMatch(activePath, pending.path)) return false

    applyEditorReveal(editorInstance, monaco, pending, diffDecorationIdsRef)
    clearEditorReveal()

    if (revealClearTimerRef.current !== null) {
      window.clearTimeout(revealClearTimerRef.current)
    }
    revealClearTimerRef.current = window.setTimeout(() => {
      if (diffDecorationIdsRef.current.length > 0) {
        editorInstance.deltaDecorations(diffDecorationIdsRef.current, [])
        diffDecorationIdsRef.current = []
      }
      revealClearTimerRef.current = null
    }, 10000)

    return true
  }, [clearEditorReveal])

  useEffect(() => {
    if (!pendingEditorReveal || !activeTab) return
    if (!pathsMatch(activeTab.path, pendingEditorReveal.path)) return

    const frame = window.requestAnimationFrame(() => {
      if (!tryApplyPendingReveal()) {
        window.requestAnimationFrame(() => {
          tryApplyPendingReveal()
        })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pendingEditorReveal, activeTab, activeTabPath, tryApplyPendingReveal])

  useEffect(() => {
    return () => {
      if (revealClearTimerRef.current !== null) {
        window.clearTimeout(revealClearTimerRef.current)
      }
      for (const disposable of editorStatsDisposablesRef.current) {
        disposable.dispose()
      }
      editorStatsDisposablesRef.current = []
    }
  }, [])

  const handleSave = async (): Promise<void> => {
    if (!activeTab) return
    await window.api.fs.writeFile(activeTab.path, activeTab.content)
    markTabSaved(activeTab.path)
  }

  const buildTabMenuItems = useCallback(
    (tabPath: string): ContextMenuItem[] => {
      const tabIndex = tabs.findIndex((tab) => tab.path === tabPath)
      const hasLeft = tabIndex > 0
      const hasRight = tabIndex >= 0 && tabIndex < tabs.length - 1
      const hasOthers = tabs.length > 1

      return [
        {
          id: 'close',
          label: 'Закрыть',
          onClick: () => closeTab(tabPath)
        },
        {
          id: 'close-left',
          label: 'Закрыть слева',
          disabled: !hasLeft,
          onClick: () => closeTabsToLeftOf(tabPath)
        },
        {
          id: 'close-right',
          label: 'Закрыть справа',
          disabled: !hasRight,
          onClick: () => closeTabsToRightOf(tabPath)
        },
        {
          id: 'close-others',
          label: 'Закрыть остальные',
          disabled: !hasOthers,
          onClick: () => closeOtherTabs(tabPath)
        }
      ]
    },
    [tabs, closeTab, closeTabsToLeftOf, closeTabsToRightOf, closeOtherTabs]
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0a0a0f]">
      {tabs.length > 0 && (
        <div className="flex items-center border-b border-white/5 bg-[#0d0d14] overflow-x-auto">
          {tabs.map((tab) => {
            const relativePath = workingDirectory
              ? getRelativePath(workingDirectory, tab.path)
              : tab.path
            const tabLabel = truncateRelativePath(relativePath, 36)

            return (
            <button
              key={tab.path}
              onClick={() => setActiveTab(tab.path)}
              onContextMenu={(event) => {
                event.preventDefault()
                setActiveTab(tab.path)
                setTabMenu({
                  x: event.clientX,
                  y: event.clientY,
                  tabPath: tab.path
                })
              }}
              onMouseDown={(event) => {
                if (event.button !== 1) return
                event.preventDefault()
                closeTab(tab.path)
              }}
              title={relativePath}
              className={cn(
                'group flex max-w-[240px] min-w-0 items-center gap-1.5 border-r border-white/5 px-3 py-1.5 text-xs transition-colors shrink-0',
                activeTabPath === tab.path
                  ? 'bg-[#0a0a0f] text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              )}
            >
              <FileIcon
                name={getFileName(tab.path)}
                className="h-3.5 w-3.5"
              />
              <span className="truncate min-w-0">
                {tab.isDirty && <span className="text-indigo-400 mr-1">●</span>}
                {tabLabel}
              </span>
              <X
                className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.path)
                }}
              />
            </button>
            )
          })}
        </div>
      )}

      {tabMenu && (
        <ExplorerContextMenu
          x={tabMenu.x}
          y={tabMenu.y}
          items={buildTabMenuItems(tabMenu.tabPath)}
          onClose={() => setTabMenu(null)}
        />
      )}

      {activeTab && isMarkdownTab && (
        <div className="flex items-center justify-between border-b border-white/5 bg-[#0d0d14] px-3 py-1.5">
          <span className="text-[11px] text-zinc-500">Markdown</span>
          <MarkdownViewToggle
            mode={markdownViewMode}
            onChange={(mode) => setTabViewMode(activeTab.path, mode)}
          />
        </div>
      )}

      <div ref={editorContainerRef} className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab ? (
          showMarkdownPreview ? (
            <MarkdownPreview content={activeTab.content} />
          ) : (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            onChange={(value) => updateTabContent(activeTab.path, value || '')}
            theme="vs-dark"
            options={{
              automaticLayout: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              bracketPairColorization: { enabled: true }
            }}
            onMount={((editorInstance, monaco) => {
              monacoEditorRef.current = editorInstance
              monacoApiRef.current = monaco

              for (const disposable of editorStatsDisposablesRef.current) {
                disposable.dispose()
              }
              editorStatsDisposablesRef.current = [
                editorInstance.onDidChangeCursorPosition(() => publishEditorStats()),
                editorInstance.onDidChangeModel(() => publishEditorStats()),
                editorInstance.onDidChangeModelContent(() => publishEditorStats())
              ]

              monaco.editor.defineTheme('agent-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [],
                colors: {
                  'editor.background': '#0a0a0f',
                  'editor.lineHighlightBackground': '#1a1a26',
                  'editor.selectionBackground': '#6366f133',
                  'editorCursor.foreground': '#8b5cf6'
                }
              })
              monaco.editor.setTheme('agent-dark')

              window.requestAnimationFrame(() => {
                tryApplyPendingReveal()
                publishEditorStats()
              })
            }) satisfies OnMount}
          />
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-6xl opacity-10">{'</>'}</div>
              <p className="text-sm text-zinc-500">Open a file from the explorer</p>
              <p className="mt-1 text-xs text-zinc-600">Ctrl+S to save</p>
            </div>
          </div>
        )}
      </div>

      {activeTab && (
        <div className="hidden" id="save-handler" onClick={handleSave} />
      )}
    </div>
  )
}
