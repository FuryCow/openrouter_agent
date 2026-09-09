import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  FileSearch,
  FolderOpen,
  Keyboard,
  Search,
  Settings,
  Terminal
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { FileIcon } from '@/components/ui/FileIcon'
import { useUiStore } from '@/stores/uiStore'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTerminalStore } from '@/stores/terminalStore'
import { loadFileForEditor } from '@/lib/loadFileForEditor'
import { useWorkspace } from '@/hooks/useWorkspace'
import { scoreCommand, scorePath } from '@/lib/commandPaletteSearch'
import { cn, getRelativePath } from '@/lib/utils'

type PaletteRow =
  | { kind: 'command'; id: string; label: string; hint?: string; shortcut?: string; run: () => void }
  | { kind: 'file'; path: string }

export function CommandPalette(): React.ReactElement {
  const { t } = useTranslation('layout')
  const open = useUiStore((s) => s.commandPaletteOpen)
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen)
  const setTerminalOpen = useSettingsStore((s) => s.setTerminalOpen)
  const addTerminalTab = useTerminalStore((s) => s.addTab)
  const openFile = useFileStore((s) => s.openFile)
  const tabs = useFileStore((s) => s.tabs)
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const { openFolderPicker } = useWorkspace()

  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commandMode = query.startsWith('>')
  const commandQuery = commandMode ? query.slice(1).trim() : ''
  const fileQuery = commandMode ? '' : query.trim()

  const commands = useMemo(
    () => [
      {
        id: 'files',
        label: t('commandPalette.commands.files'),
        hint: t('commandPalette.commands.filesHint'),
        shortcut: 'Ctrl+P',
        keywords: ['file', 'open', 'go'],
        run: () => {
          setQuery('')
          inputRef.current?.focus()
        }
      },
      {
        id: 'settings',
        label: t('commandPalette.commands.settings'),
        shortcut: 'Ctrl+L',
        keywords: ['settings', 'preferences', 'api'],
        run: () => {
          setOpen(false)
          setSettingsOpen(true)
        }
      },
      {
        id: 'shortcuts',
        label: t('commandPalette.commands.shortcuts'),
        shortcut: 'Ctrl+/',
        keywords: ['keyboard', 'help'],
        run: () => {
          setOpen(false)
          setShortcutsOpen(true)
        }
      },
      {
        id: 'terminal',
        label: t('commandPalette.commands.terminal'),
        shortcut: 'Ctrl+`',
        keywords: ['terminal', 'shell'],
        run: () => {
          setOpen(false)
          setTerminalOpen(true)
        }
      },
      {
        id: 'new-terminal',
        label: t('commandPalette.commands.newTerminal'),
        shortcut: 'Ctrl+Shift+`',
        keywords: ['terminal', 'tab'],
        run: () => {
          setOpen(false)
          setTerminalOpen(true)
          addTerminalTab(workingDirectory)
        }
      },
      {
        id: 'open-folder',
        label: t('commandPalette.commands.openFolder'),
        keywords: ['workspace', 'project', 'folder'],
        run: () => {
          setOpen(false)
          void openFolderPicker()
        }
      }
    ],
    [
      t,
      setOpen,
      setSettingsOpen,
      setShortcutsOpen,
      setTerminalOpen,
      addTerminalTab,
      workingDirectory,
      openFolderPicker
    ]
  )

  const filteredCommands = useMemo(() => {
    return commands
      .map((command) => ({
        ...command,
        score: scoreCommand(command.label, command.keywords, commandQuery)
      }))
      .filter((command) => command.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  }, [commands, commandQuery])

  const recentPaths = useMemo(() => [...tabs].reverse().map((tab) => tab.path), [tabs])

  const filteredFiles = useMemo(() => {
    if (commandMode) return []

    const source = fileQuery ? files : recentPaths

    return source
      .map((path) => ({ path, score: fileQuery ? scorePath(path, fileQuery) : 1 }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, fileQuery ? 50 : 12)
  }, [commandMode, fileQuery, files, recentPaths])

  const rows = useMemo((): PaletteRow[] => {
    if (commandMode) {
      return filteredCommands.map((command) => ({
        kind: 'command',
        id: command.id,
        label: command.label,
        hint: command.hint,
        shortcut: command.shortcut,
        run: command.run
      }))
    }

    const commandRows: PaletteRow[] =
      fileQuery.length > 0
        ? []
        : filteredCommands.slice(0, 6).map((command) => ({
            kind: 'command',
            id: command.id,
            label: command.label,
            hint: command.hint,
            shortcut: command.shortcut,
            run: command.run
          }))

    const fileRows: PaletteRow[] = filteredFiles.map((item) => ({
      kind: 'file',
      path: item.path
    }))

    return [...commandRows, ...fileRows]
  }, [commandMode, fileQuery, filteredCommands, filteredFiles])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setFiles([])
      setActiveIndex(0)
      return
    }

    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    if (!workingDirectory) {
      return () => cancelAnimationFrame(frame)
    }

    setLoading(true)
    void window.api.fs
      .listWorkspaceFiles()
      .then((paths) => setFiles(paths.filter((path) => !path.endsWith('/') && !path.endsWith('\\'))))
      .finally(() => setLoading(false))

    return () => cancelAnimationFrame(frame)
  }, [open, workingDirectory])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, rows.length])

  const runRow = useCallback(
    async (row: PaletteRow): Promise<void> => {
      if (row.kind === 'command') {
        row.run()
        return
      }

      const content = await loadFileForEditor(row.path)
      openFile(row.path, content)
      setOpen(false)
    },
    [openFile, setOpen]
  )

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(rows.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (e.key === 'Enter' && rows[activeIndex]) {
      e.preventDefault()
      void runRow(rows[activeIndex])
    }
  }

  const commandIcon = (id: string): React.ReactElement => {
    switch (id) {
      case 'files':
        return <FileSearch className="h-4 w-4" />
      case 'settings':
        return <Settings className="h-4 w-4" />
      case 'shortcuts':
        return <Keyboard className="h-4 w-4" />
      case 'terminal':
      case 'new-terminal':
        return <Terminal className="h-4 w-4" />
      case 'open-folder':
        return <FolderOpen className="h-4 w-4" />
      default:
        return <ChevronRight className="h-4 w-4" />
    }
  }

  let fileSectionStarted = false

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[10%] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <div className="border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('commandPalette.inputPlaceholder')}
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-[min(24rem,50vh)] overflow-y-auto p-1.5">
          {!workingDirectory ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-zinc-500">{t('quickOpen.noFolder')}</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  void openFolderPicker()
                }}
                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/15"
              >
                {t('quickOpen.openFolder')}
              </button>
            </div>
          ) : loading && fileQuery ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t('quickOpen.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t('commandPalette.noResults')}</p>
          ) : (
            rows.map((row, index) => {
              const showRecentHeader =
                row.kind === 'file' && !fileQuery && !fileSectionStarted && !commandMode
              if (showRecentHeader) fileSectionStarted = true

              return (
                <div key={row.kind === 'command' ? row.id : row.path}>
                  {showRecentHeader && (
                    <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-600">
                      {t('commandPalette.recentlyOpened')}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void runRow(row)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                      index === activeIndex
                        ? 'bg-indigo-500/15 text-zinc-100'
                        : 'text-zinc-300 hover:bg-white/[0.04]'
                    )}
                  >
                    {row.kind === 'command' ? (
                      <>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-zinc-400 ring-1 ring-inset ring-white/10">
                          {commandIcon(row.id)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{row.label}</span>
                          {row.hint && (
                            <span className="block truncate text-[10px] text-zinc-600">{row.hint}</span>
                          )}
                        </span>
                        {row.shortcut && (
                          <kbd className="shrink-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                            {row.shortcut}
                          </kbd>
                        )}
                        {!row.shortcut && row.id === 'files' && (
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                        )}
                      </>
                    ) : (
                      <>
                        <FileIcon
                          name={row.path.split(/[/\\]/).pop() ?? row.path}
                          className="h-4 w-4 shrink-0 opacity-80"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {row.path.split(/[/\\]/).pop() ?? row.path}
                          </span>
                          <span className="block truncate text-[10px] text-zinc-600">
                            {workingDirectory
                              ? getRelativePath(workingDirectory, row.path)
                              : row.path}
                          </span>
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
