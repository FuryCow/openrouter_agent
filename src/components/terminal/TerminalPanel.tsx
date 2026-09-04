import { useEffect, useRef } from 'react'
import { Terminal as TerminalIcon } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useFileStore } from '@/stores/fileStore'
import { Button } from '../ui/button'
import { useSettingsStore } from '@/stores/settingsStore'

export function TerminalPanel(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const termIdRef = useRef<string | null>(null)
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const terminalOpen = useSettingsStore((s) => s.terminalOpen)
  const setTerminalOpen = useSettingsStore((s) => s.setTerminalOpen)

  useEffect(() => {
    if (!containerRef.current || !terminalOpen) return

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
    term.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = term
    fitAddonRef.current = fitAddon

    let unsubData: (() => void) | undefined

    const init = async (): Promise<void> => {
      const id = await window.api.terminal.create(workingDirectory || undefined)
      termIdRef.current = id

      unsubData = window.api.terminal.onData((termId, data) => {
        if (termId === id) term.write(data)
      })

      term.onData((data) => {
        window.api.terminal.write(id, data)
      })

      term.onResize(({ cols, rows }) => {
        window.api.terminal.resize(id, cols, rows)
      })
    }

    init()

    const handleResize = (): void => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit())
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      unsubData?.()
      if (termIdRef.current) {
        window.api.terminal.destroy(termIdRef.current)
      }
      term.dispose()
    }
  }, [terminalOpen, workingDirectory])

  if (!terminalOpen) {
    return (
      <div className="flex h-full min-h-0 items-center overflow-hidden border-t border-white/5 bg-[#0d0d14] px-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-zinc-500 hover:text-zinc-300"
          onClick={() => setTerminalOpen(true)}
          title="Show terminal (Ctrl+`)"
        >
          <TerminalIcon className="mr-1 h-3 w-3" />
          Показать терминал
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-white/5 bg-[#0a0a0f]">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <TerminalIcon className="h-3 w-3" />
          Terminal
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-[10px] text-zinc-600 hover:text-zinc-400"
          onClick={() => setTerminalOpen(false)}
          title="Hide terminal (Ctrl+`)"
        >
          Скрыть
        </Button>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-1" />
    </div>
  )
}
