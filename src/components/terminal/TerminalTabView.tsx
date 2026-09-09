import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { cn } from '@/lib/utils'
import { trackFirstCommandInput, createCommandInputTracker } from '@/lib/terminalTabTitle'

export interface TerminalTabHandle {
  sessionId: string
  term: Terminal
  fitAddon: FitAddon
}

interface TerminalTabViewProps {
  tabId: string
  cwd: string | null
  isActive: boolean
  onReady: (tabId: string, handle: TerminalTabHandle) => void
  onDispose: (tabId: string) => void
  onFirstCommand: (tabId: string, command: string) => void
}

function createTerminal(): { term: Terminal; fitAddon: FitAddon } {
  const term = new Terminal({
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    theme: {
      background: '#0a0a0f',
      foreground: '#e4e4e7',
      cursor: '#8b5cf6',
      selectionBackground: '#6366f144',
      black: '#18181b',
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#eab308',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#e4e4e7'
    },
    cursorBlink: true,
    scrollback: 5000
  })
  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  return { term, fitAddon }
}

export function TerminalTabView({
  tabId,
  cwd,
  isActive,
  onReady,
  onDispose,
  onFirstCommand
}: TerminalTabViewProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const { term, fitAddon } = createTerminal()
    fitAddonRef.current = fitAddon
    term.open(container)

    let disposed = false
    let sessionId: string | null = null
    let inputTracker = createCommandInputTracker()
    let named = false

    const init = async (): Promise<void> => {
      const id = await window.api.terminal.create(cwd || undefined)
      if (disposed) {
        void window.api.terminal.destroy(id)
        term.dispose()
        return
      }

      sessionId = id
      onReady(tabId, { sessionId: id, term, fitAddon })

      term.onData((data) => {
        window.api.terminal.write(id, data)

        if (named) return
        inputTracker = trackFirstCommandInput(data, inputTracker, (command) => {
          named = true
          onFirstCommand(tabId, command)
        })
      })

      term.onResize(({ cols, rows }) => {
        window.api.terminal.resize(id, cols, rows)
      })

      if (isActive) {
        fitAddon.fit()
      }
    }

    void init()

    return () => {
      disposed = true
      fitAddonRef.current = null
      onDispose(tabId)
      if (sessionId) {
        void window.api.terminal.destroy(sessionId)
      }
      term.dispose()
    }
  }, [tabId, cwd, onReady, onDispose, onFirstCommand])

  useEffect(() => {
    if (!isActive) return
    fitAddonRef.current?.fit()
  }, [isActive])

  return (
    <div
      ref={containerRef}
      className={cn('absolute inset-0 overflow-hidden p-1', !isActive && 'invisible pointer-events-none')}
      aria-hidden={!isActive}
    />
  )
}
