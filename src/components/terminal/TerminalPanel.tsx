import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Terminal as TerminalIcon, X } from 'lucide-react'
import { useFileStore } from '@/stores/fileStore'
import { useTerminalStore } from '@/stores/terminalStore'
import { Button } from '../ui/button'
import { useSettingsStore } from '@/stores/settingsStore'
import { scheduleInAnimationFrame } from '@/lib/animation-frame'
import { cn } from '@/lib/utils'
import { TerminalTabView, type TerminalTabHandle } from './TerminalTabView'

export function TerminalPanel(): React.ReactElement {
  const { t } = useTranslation('layout')
  const containerRef = useRef<HTMLDivElement>(null)
  const handlesRef = useRef<Map<string, TerminalTabHandle>>(new Map())
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const terminalOpen = useSettingsStore((s) => s.terminalOpen)
  const setTerminalOpen = useSettingsStore((s) => s.setTerminalOpen)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const ensureInitialTab = useTerminalStore((s) => s.ensureInitialTab)
  const addTab = useTerminalStore((s) => s.addTab)
  const closeTab = useTerminalStore((s) => s.closeTab)
  const setActiveTab = useTerminalStore((s) => s.setActiveTab)
  const renameFromFirstCommand = useTerminalStore((s) => s.renameFromFirstCommand)

  useEffect(() => {
    if (terminalOpen) {
      ensureInitialTab(workingDirectory)
    }
  }, [terminalOpen, workingDirectory, ensureInitialTab])

  const fitActiveTerminal = useCallback((): void => {
    if (!activeTabId) return
    handlesRef.current.get(activeTabId)?.fitAddon.fit()
  }, [activeTabId])

  const handleReady = useCallback((tabId: string, handle: TerminalTabHandle) => {
    handlesRef.current.set(tabId, handle)
    if (tabId === useTerminalStore.getState().activeTabId) {
      scheduleInAnimationFrame(() => handle.fitAddon.fit())
    }
  }, [])

  const handleDispose = useCallback((tabId: string) => {
    handlesRef.current.delete(tabId)
  }, [])

  const handleFirstCommand = useCallback(
    (tabId: string, command: string) => {
      renameFromFirstCommand(tabId, command)
    },
    [renameFromFirstCommand]
  )

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const result = closeTab(tabId)
      if (result === 'hide-panel') {
        setTerminalOpen(false)
      }
    },
    [closeTab, setTerminalOpen]
  )

  useEffect(() => {
    if (!terminalOpen) return

    return window.api.terminal.onData((sessionId, data) => {
      for (const handle of handlesRef.current.values()) {
        if (handle.sessionId === sessionId) {
          handle.term.write(data)
          break
        }
      }
    })
  }, [terminalOpen])

  useEffect(() => {
    if (!terminalOpen) return
    fitActiveTerminal()
  }, [activeTabId, terminalOpen, fitActiveTerminal])

  useEffect(() => {
    if (!terminalOpen || !containerRef.current) return

    const scheduleFit = (): void => {
      scheduleInAnimationFrame(fitActiveTerminal)
    }

    window.addEventListener('resize', scheduleFit)
    const resizeObserver = new ResizeObserver(scheduleFit)
    resizeObserver.observe(containerRef.current)

    return () => {
      window.removeEventListener('resize', scheduleFit)
      resizeObserver.disconnect()
    }
  }, [terminalOpen, fitActiveTerminal])

  if (!terminalOpen) {
    return (
      <div className="flex h-full min-h-0 items-center overflow-hidden border-t border-white/5 bg-background px-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-zinc-500 hover:text-zinc-300"
          onClick={() => setTerminalOpen(true)}
          title={t('terminal.showTooltip')}
        >
          <TerminalIcon className="mr-1 h-3 w-3" />
          {t('terminal.show')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-white/5 bg-background">
      <div className="flex items-stretch border-b border-white/5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-2 py-1.5">
          {tabs.map((tab) => {
            const active = tab.id === activeTabId
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                onMouseDown={(event) => {
                  if (event.button !== 1) return
                  event.preventDefault()
                  handleCloseTab(tab.id)
                }}
                title={tab.title}
                className={cn(
                  'group flex h-7 max-w-[220px] min-w-0 shrink-0 items-center gap-1.5 rounded-md border px-1.5 text-left transition-all',
                  active
                    ? 'border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-indigo-500/5 shadow-[0_0_20px_-6px_rgba(99,102,241,0.55)]'
                    : 'border-white/10 bg-white/[0.02] hover:border-indigo-400/25 hover:bg-indigo-500/[0.06]'
                )}
              >
                <span
                  className={cn(
                    'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] ring-1 ring-inset',
                    active
                      ? 'bg-gradient-to-br from-indigo-500/30 to-violet-500/20 ring-indigo-400/30'
                      : 'bg-white/[0.04] ring-white/10 group-hover:ring-indigo-400/20'
                  )}
                >
                  <TerminalIcon
                    className={cn('h-2.5 w-2.5', active ? 'text-indigo-200' : 'text-zinc-500')}
                  />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide',
                    active ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'
                  )}
                >
                  {tab.title}
                </span>
                <X
                  className="h-3 w-3 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleCloseTab(tab.id)
                  }}
                />
              </button>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1 border-l border-white/5 px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 rounded-md border border-white/10 p-0 text-zinc-500 hover:border-indigo-400/25 hover:bg-indigo-500/[0.06] hover:text-zinc-300"
            onClick={() => addTab(workingDirectory)}
            title={t('terminal.newTabTooltip')}
            aria-label={t('terminal.newTab')}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-md border border-transparent px-2 text-[10px] text-zinc-600 hover:border-white/10 hover:bg-white/[0.04] hover:text-zinc-400"
            onClick={() => setTerminalOpen(false)}
            title={t('terminal.hideTooltip')}
          >
            {t('terminal.hide')}
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        {tabs.map((tab) => (
          <TerminalTabView
            key={tab.id}
            tabId={tab.id}
            cwd={tab.cwd}
            isActive={tab.id === activeTabId}
            onReady={handleReady}
            onDispose={handleDispose}
            onFirstCommand={handleFirstCommand}
          />
        ))}
      </div>
    </div>
  )
}
