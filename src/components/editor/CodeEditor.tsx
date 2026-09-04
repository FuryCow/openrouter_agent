import { useCallback, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { X } from 'lucide-react'
import { useFileStore, type EditorRevealRequest } from '@/stores/fileStore'
import { getFileName, cn } from '@/lib/utils'

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
  const activeTabPath = useFileStore((s) => s.activeTabPath)
  const pendingEditorReveal = useFileStore((s) => s.pendingEditorReveal)
  const setActiveTab = useFileStore((s) => s.setActiveTab)
  const closeTab = useFileStore((s) => s.closeTab)
  const updateTabContent = useFileStore((s) => s.updateTabContent)
  const markTabSaved = useFileStore((s) => s.markTabSaved)
  const clearEditorReveal = useFileStore((s) => s.clearEditorReveal)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoApiRef = useRef<typeof import('monaco-editor') | null>(null)
  const diffDecorationIdsRef = useRef<string[]>([])
  const revealClearTimerRef = useRef<number | null>(null)

  const activeTab = tabs.find((t) => t.path === activeTabPath)

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
    const container = editorContainerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      monacoEditorRef.current?.layout()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

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
    }
  }, [])

  const handleSave = async (): Promise<void> => {
    if (!activeTab) return
    await window.api.fs.writeFile(activeTab.path, activeTab.content)
    markTabSaved(activeTab.path)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0a0a0f]">
      {tabs.length > 0 && (
        <div className="flex items-center border-b border-white/5 bg-[#0d0d14] overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.path}
              onClick={() => setActiveTab(tab.path)}
              className={cn(
                'group flex items-center gap-2 border-r border-white/5 px-3 py-1.5 text-xs transition-colors',
                activeTabPath === tab.path
                  ? 'bg-[#0a0a0f] text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              )}
            >
              <span className="truncate max-w-[120px]">
                {tab.isDirty && <span className="text-indigo-400 mr-1">●</span>}
                {getFileName(tab.path)}
              </span>
              <X
                className="h-3 w-3 opacity-0 group-hover:opacity-100 hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.path)
                }}
              />
            </button>
          ))}
        </div>
      )}

      <div ref={editorContainerRef} className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab ? (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            onChange={(value) => updateTabContent(activeTab.path, value || '')}
            theme="vs-dark"
            options={{
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
              })
            }) satisfies OnMount}
          />
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
