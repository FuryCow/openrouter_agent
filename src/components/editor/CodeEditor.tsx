import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { X } from 'lucide-react'
import { useFileStore, type EditorRevealRequest } from '@/stores/fileStore'
import { FileIcon } from '@/components/ui/FileIcon'
import { getFileName, getRelativePath, truncateRelativePath, isMarkdownPath, isImagePath, cn } from '@/lib/utils'
import { MarkdownPreview } from '@/components/editor/MarkdownPreview'
import { ImagePreview } from '@/components/editor/ImagePreview'
import { MarkdownViewToggle } from '@/components/editor/MarkdownViewToggle'
import { EditorEmptyState } from '@/components/editor/EditorEmptyState'
import {
  ExplorerContextMenu,
  type ContextMenuItem
} from '@/components/explorer/ExplorerContextMenu'
import { useEditorStore } from '@/stores/editorStore'
import { useAgentContextStore } from '@/stores/agentContextStore'
import { buildEditorFileStats } from '@/lib/editorFileStats'
import { setupMonacoEditorFeatures, registerResolveInChatEditorActions } from '@/lib/monacoEditorSetup'

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

function diffDecorationOptions(
  monaco: typeof import('monaco-editor'),
  kind: 'add' | 'del'
): editor.IModelDecorationOptions {
  const color = kind === 'add' ? '#34d399' : '#f87171'
  return {
    minimap: {
      color,
      position: monaco.editor.MinimapPosition.Inline
    },
    overviewRuler: {
      color,
      position: monaco.editor.OverviewRulerLane.Left
    }
  }
}

function buildDeletedLineViewZoneDom(
  editorInstance: editor.IStandaloneCodeEditor,
  monaco: typeof import('monaco-editor'),
  content: string
): HTMLDivElement {
  const lineHeight = editorInstance.getOption(monaco.editor.EditorOption.lineHeight)
  const fontSize = editorInstance.getOption(monaco.editor.EditorOption.fontSize)
  const fontFamily = editorInstance.getOption(monaco.editor.EditorOption.fontFamily)
  const { contentLeft, lineNumbersWidth, glyphMarginWidth } = editorInstance.getLayoutInfo()
  const gutterWidth = glyphMarginWidth + lineNumbersWidth

  const domNode = document.createElement('div')
  domNode.className = 'file-diff-viewzone-deleted'
  domNode.style.setProperty('--diff-line-height', `${lineHeight}px`)
  domNode.style.setProperty('--diff-font-size', `${fontSize}px`)
  domNode.style.setProperty('--diff-font-family', fontFamily)
  domNode.style.setProperty('--diff-content-left', `${contentLeft}px`)
  domNode.style.setProperty('--diff-gutter-width', `${gutterWidth}px`)
  domNode.style.height = `${lineHeight}px`
  domNode.style.minHeight = `${lineHeight}px`

  const marker = document.createElement('span')
  marker.className = 'file-diff-viewzone-marker'
  marker.textContent = '−'

  const text = document.createElement('span')
  text.className = 'file-diff-viewzone-text'
  text.textContent = content

  domNode.append(marker, text)
  return domNode
}

function applyEditorReveal(
  editorInstance: editor.IStandaloneCodeEditor,
  monaco: typeof import('monaco-editor'),
  request: EditorRevealRequest,
  decorationIdsRef: React.MutableRefObject<string[]>,
  viewZoneIdsRef: React.MutableRefObject<string[]>
): void {
  editorInstance.revealLineInCenter(request.scrollToLine)

  if (decorationIdsRef.current.length > 0) {
    editorInstance.deltaDecorations(decorationIdsRef.current, [])
  }

  editorInstance.changeViewZones((accessor) => {
    for (const id of viewZoneIdsRef.current) {
      accessor.removeZone(id)
    }
    viewZoneIdsRef.current = []

    const previewLines = [
      ...(request.deletedLines ?? []),
      ...(request.modifiedLines ?? [])
    ].sort((a, b) => a.afterLine - b.afterLine || a.content.localeCompare(b.content))

    for (const preview of previewLines) {
      const domNode = buildDeletedLineViewZoneDom(editorInstance, monaco, preview.content)

      const zoneId = accessor.addZone({
        afterLineNumber: Math.max(0, preview.afterLine),
        heightInLines: 1,
        domNode,
        suppressMouseDown: true
      })
      viewZoneIdsRef.current.push(zoneId)
    }
  })

  const decorations: editor.IModelDeltaDecoration[] = []

  for (const deleted of request.deletedLines ?? []) {
    const markerLine = Math.max(1, deleted.afterLine + 1)
    decorations.push({
      range: new monaco.Range(markerLine, 1, markerLine, 1),
      options: diffDecorationOptions(monaco, 'del')
    })
  }

  for (const range of request.highlightRanges) {
    for (let line = range.startLine; line <= range.endLine; line++) {
      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'file-diff-highlight-line',
          linesDecorationsClassName: 'file-diff-highlight-gutter',
          ...diffDecorationOptions(monaco, 'add')
        }
      })
    }
  }

  for (const inline of request.inlineRanges ?? []) {
    decorations.push({
      range: new monaco.Range(
        inline.line,
        inline.startColumn,
        inline.line,
        inline.endColumn
      ),
      options: {
        inlineClassName: 'file-diff-inline-add',
        className: 'file-diff-inline-add-line',
        ...diffDecorationOptions(monaco, 'add')
      }
    })
  }

  for (const removed of request.inlineDeleteHighlights ?? []) {
    decorations.push({
      range: new monaco.Range(
        removed.line,
        removed.insertColumn,
        removed.line,
        removed.insertColumn
      ),
      options: {
        before: {
          content: removed.removedText,
          inlineClassName: 'file-diff-inline-del',
          cursorStops: monaco.editor.InjectedTextCursorStops.None
        },
        linesDecorationsClassName: 'file-diff-deleted-gutter',
        ...diffDecorationOptions(monaco, 'del')
      }
    })
  }

  decorationIdsRef.current = editorInstance.deltaDecorations([], decorations)
}

export function CodeEditor(): React.ReactElement {
  const { t } = useTranslation('layout')
  const { t: tCommon } = useTranslation('common')
  const { t: tChat } = useTranslation('chat')
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
  const diffViewZoneIdsRef = useRef<string[]>([])
  const revealClearTimerRef = useRef<number | null>(null)
  const editorStatsDisposablesRef = useRef<Array<{ dispose: () => void }>>([])
  const resolveInChatDisposableRef = useRef<{ dispose: () => void } | null>(null)
  const [tabMenu, setTabMenu] = useState<TabContextMenuState | null>(null)
  const setEditorStats = useEditorStore((s) => s.setStats)

  const activeTab = tabs.find((t) => t.path === activeTabPath)
  const isMarkdownTab = activeTab ? isMarkdownPath(activeTab.path) : false
  const isImageTab = activeTab ? isImagePath(activeTab.path) : false
  const markdownViewMode = activeTab?.viewMode ?? 'edit'
  const showMarkdownPreview = isMarkdownTab && markdownViewMode === 'preview'

  const publishEditorStats = useCallback((): void => {
    const state = useFileStore.getState()
    const tab = state.tabs.find((item) => item.path === state.activeTabPath)
    if (!tab) {
      setEditorStats(null)
      return
    }

    const preview =
      isMarkdownPath(tab.path) && (tab.viewMode ?? 'edit') === 'preview'
    const imagePreview = isImagePath(tab.path)
    setEditorStats(
      buildEditorFileStats(tab, preview || imagePreview ? null : monacoEditorRef.current, {
        showCursor: !preview && !imagePreview
      })
    )
  }, [setEditorStats])

  useEffect(() => {
    publishEditorStats()
  }, [activeTab, activeTab?.content, activeTab?.language, showMarkdownPreview, isImageTab, publishEditorStats])

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

    applyEditorReveal(editorInstance, monaco, pending, diffDecorationIdsRef, diffViewZoneIdsRef)
    clearEditorReveal()

    if (pending.persistent) return true

    if (revealClearTimerRef.current !== null) {
      window.clearTimeout(revealClearTimerRef.current)
    }
    revealClearTimerRef.current = window.setTimeout(() => {
      if (diffDecorationIdsRef.current.length > 0) {
        editorInstance.deltaDecorations(diffDecorationIdsRef.current, [])
        diffDecorationIdsRef.current = []
      }
      editorInstance.changeViewZones((accessor) => {
        for (const id of diffViewZoneIdsRef.current) {
          accessor.removeZone(id)
        }
        diffViewZoneIdsRef.current = []
      })
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
      resolveInChatDisposableRef.current?.dispose()
      resolveInChatDisposableRef.current = null
    }
  }, [])

  const handleSave = async (): Promise<void> => {
    if (!activeTab || isImagePath(activeTab.path)) return
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
          id: 'pin-context',
          label: tChat('agentContext.pinInContext'),
          onClick: () => {
            useAgentContextStore.getState().pinPath(tabPath)
          }
        },
        {
          id: 'close',
          label: t('editor.tabs.close'),
          onClick: () => closeTab(tabPath)
        },
        {
          id: 'close-left',
          label: t('editor.tabs.closeLeft'),
          disabled: !hasLeft,
          onClick: () => closeTabsToLeftOf(tabPath)
        },
        {
          id: 'close-right',
          label: t('editor.tabs.closeRight'),
          disabled: !hasRight,
          onClick: () => closeTabsToRightOf(tabPath)
        },
        {
          id: 'close-others',
          label: t('editor.tabs.closeOthers'),
          disabled: !hasOthers,
          onClick: () => closeOtherTabs(tabPath)
        }
      ]
    },
    [tabs, closeTab, closeTabsToLeftOf, closeTabsToRightOf, closeOtherTabs, t, tChat]
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {tabs.length > 0 && (
        <div className="chrome-header overflow-x-auto bg-background px-0">
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
                'group relative flex h-9 max-w-[240px] min-w-0 shrink-0 items-center gap-1.5 border-r border-white/5 px-3 text-xs transition-colors',
                activeTabPath === tab.path
                  ? 'bg-background text-zinc-200 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-indigo-500/80'
                  : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
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
        <div className="chrome-header justify-between bg-background px-3">
          <span className="text-[11px] text-zinc-500">{tCommon('labels.markdown')}</span>
          <MarkdownViewToggle
            mode={markdownViewMode}
            onChange={(mode) => setTabViewMode(activeTab.path, mode)}
          />
        </div>
      )}

      {activeTab && isImageTab && (
        <div className="chrome-header bg-background px-3">
          <span className="text-[11px] text-zinc-500">{t('editor.imagePreview')}</span>
        </div>
      )}

      <div ref={editorContainerRef} className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab ? (
          showMarkdownPreview ? (
            <MarkdownPreview content={activeTab.content} />
          ) : isImageTab ? (
            <ImagePreview src={activeTab.content} alt={getFileName(activeTab.path)} />
          ) : (
          <Editor
            height="100%"
            path={activeTab.path}
            language={activeTab.language}
            value={activeTab.content}
            onChange={(value) => updateTabContent(activeTab.path, value || '')}
            theme="vs-dark"
            options={{
              automaticLayout: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              minimap: { enabled: true, showSlider: 'always' },
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              bracketPairColorization: { enabled: true },
              hover: { enabled: true },
              lightbulb: { enabled: 'on' }
            }}
            onMount={((editorInstance, monaco) => {
              setupMonacoEditorFeatures(monaco)
              resolveInChatDisposableRef.current?.dispose()
              resolveInChatDisposableRef.current = registerResolveInChatEditorActions(
                editorInstance,
                monaco
              )
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
          <EditorEmptyState />
        )}
      </div>

      {activeTab && (
        <div className="hidden" id="save-handler" onClick={handleSave} />
      )}
    </div>
  )
}
