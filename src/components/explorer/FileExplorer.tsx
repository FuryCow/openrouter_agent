import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  RefreshCw
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { ExplorerContextMenu, type ContextMenuItem } from './ExplorerContextMenu'
import { NameInputDialog } from './NameInputDialog'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import type { DirEntry } from '@/types'
import { cn } from '@/lib/utils'

function isValidEntryName(name: string): boolean {
  return name.length > 0 && !/[\\/<>:"|?*]/.test(name)
}

function FileIcon({
  name,
  isDirectory,
  isOpen
}: {
  name: string
  isDirectory: boolean
  isOpen?: boolean
}): React.ReactElement {
  if (isDirectory) {
    return isOpen ? (
      <FolderOpen className="h-4 w-4 text-indigo-400" />
    ) : (
      <Folder className="h-4 w-4 text-indigo-400/70" />
    )
  }

  const ext = name.split('.').pop()?.toLowerCase()
  const colorMap: Record<string, string> = {
    ts: 'text-blue-400',
    tsx: 'text-blue-400',
    js: 'text-yellow-400',
    jsx: 'text-yellow-400',
    json: 'text-amber-400',
    md: 'text-zinc-400',
    css: 'text-pink-400',
    html: 'text-orange-400',
    py: 'text-green-400'
  }

  return <File className={cn('h-4 w-4', colorMap[ext || ''] || 'text-zinc-500')} />
}

function TreeNode({
  entry,
  depth,
  refreshKey,
  expandPath,
  onExpandHandled,
  onFileClick,
  onContextMenu
}: {
  entry: DirEntry
  depth: number
  refreshKey: number
  expandPath: string | null
  onExpandHandled: (path: string) => void
  onFileClick: (path: string) => void
  onContextMenu: (event: React.MouseEvent, entry: DirEntry) => void
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(false)

  const loadChildren = useCallback(async () => {
    if (!entry.isDirectory) return
    setLoading(true)
    try {
      const items = await window.api.fs.listDir(entry.path)
      setChildren(items)
    } finally {
      setLoading(false)
    }
  }, [entry.path, entry.isDirectory])

  useEffect(() => {
    if (expanded) {
      void loadChildren()
    }
  }, [expanded, refreshKey, loadChildren])

  useEffect(() => {
    if (expandPath === entry.path && entry.isDirectory) {
      setExpanded(true)
      void loadChildren()
      onExpandHandled(entry.path)
    }
  }, [expandPath, entry.path, entry.isDirectory, loadChildren, onExpandHandled])

  const handleClick = async (): Promise<void> => {
    if (entry.isDirectory) {
      if (!expanded) await loadChildren()
      setExpanded(!expanded)
    } else {
      onFileClick(entry.path)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-white/5 transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {entry.isDirectory ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-zinc-500" />
          )
        ) : (
          <span className="w-3" />
        )}
        <FileIcon name={entry.name} isDirectory={entry.isDirectory} isOpen={expanded} />
        <span className="truncate">{entry.name}</span>
        {loading && <RefreshCw className="ml-auto h-3 w-3 animate-spin text-zinc-500" />}
      </button>

      <AnimatePresence>
        {expanded && children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {children.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                refreshKey={refreshKey}
                expandPath={expandPath}
                onExpandHandled={onExpandHandled}
                onFileClick={onFileClick}
                onContextMenu={onContextMenu}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface MenuState {
  x: number
  y: number
  entry: DirEntry
}

interface NamePromptState {
  title: string
  defaultValue: string
  confirmLabel?: string
  onConfirm: (name: string) => void
}

export function FileExplorer(): React.ReactElement {
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const setWorkingDirectory = useFileStore((s) => s.setWorkingDirectory)
  const openFile = useFileStore((s) => s.openFile)
  const closeTabsUnderPath = useFileStore((s) => s.closeTabsUnderPath)
  const renameTabPath = useFileStore((s) => s.renameTabPath)
  const settings = useSettingsStore((s) => s.settings)
  const addToast = useToastStore((s) => s.addToast)
  const [rootEntries, setRootEntries] = useState<DirEntry[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null)
  const [expandPath, setExpandPath] = useState<string | null>(null)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const loadRoot = useCallback(async () => {
    if (!workingDirectory) return
    try {
      const entries = await window.api.fs.listDir(workingDirectory)
      setRootEntries(entries)
    } catch (err) {
      setRootEntries([])
      setWorkingDirectory(null)
      const saved = await window.api.settings.get()
      await window.api.settings.save({ ...saved, workingDirectory: '' })
      addToast(err instanceof Error ? err.message : 'Workspace folder is not allowed', 'error')
    }
  }, [workingDirectory, setWorkingDirectory, addToast])

  useEffect(() => {
    loadRoot()
  }, [loadRoot, refreshKey])

  useEffect(() => {
    if (!workingDirectory) return
    return window.api.fs.onWorkspaceChanged(() => refresh())
  }, [workingDirectory, refresh])

  const handleOpenFolder = async (): Promise<void> => {
    try {
      const path = await window.api.fs.openFolder()
      if (path) {
        setWorkingDirectory(path)
        await window.api.settings.save({ ...settings, workingDirectory: path })
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'This folder cannot be used as workspace', 'error')
    }
  }

  const handleFileClick = async (path: string): Promise<void> => {
    const content = await window.api.fs.readFile(path)
    openFile(path, content)
  }

  const openNamePrompt = (config: NamePromptState): void => {
    setMenu(null)
    setNamePrompt(config)
  }

  const handleContextMenu = (event: React.MouseEvent, entry: DirEntry): void => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, entry })
  }

  const handleWorkspaceContextMenu = (event: React.MouseEvent): void => {
    if (!workingDirectory) return
    event.preventDefault()
    setMenu({
      x: event.clientX,
      y: event.clientY,
      entry: {
        name: workingDirectory.split(/[/\\]/).pop() || workingDirectory,
        path: workingDirectory,
        isDirectory: true
      }
    })
  }

  const buildMenuItems = (entry: DirEntry): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []

    if (!entry.isDirectory) {
      items.push({
        id: 'open',
        label: 'Открыть',
        onClick: () => {
          void handleFileClick(entry.path)
        }
      })
    }

    if (entry.isDirectory) {
      items.push(
        {
          id: 'new-file',
          label: 'Новый файл',
          onClick: () => {
            openNamePrompt({
              title: 'Новый файл',
              defaultValue: 'untitled.txt',
              confirmLabel: 'Создать',
              onConfirm: (name) => {
                if (!isValidEntryName(name)) {
                  addToast('Недопустимое имя файла', 'error')
                  return
                }
                void window.api.fs
                  .createFile(entry.path, name)
                  .then((path) => {
                    setExpandPath(entry.path)
                    refresh()
                    addToast(`Создан файл ${name}`, 'success')
                    return handleFileClick(path)
                  })
                  .catch((err) =>
                    addToast(err instanceof Error ? err.message : 'Не удалось создать файл', 'error')
                  )
              }
            })
          }
        },
        {
          id: 'new-folder',
          label: 'Новая папка',
          onClick: () => {
            openNamePrompt({
              title: 'Новая папка',
              defaultValue: 'new-folder',
              confirmLabel: 'Создать',
              onConfirm: (name) => {
                if (!isValidEntryName(name)) {
                  addToast('Недопустимое имя папки', 'error')
                  return
                }
                void window.api.fs
                  .createDirectory(entry.path, name)
                  .then(() => {
                    setExpandPath(entry.path)
                    refresh()
                    addToast(`Создана папка ${name}`, 'success')
                  })
                  .catch((err) =>
                    addToast(err instanceof Error ? err.message : 'Не удалось создать папку', 'error')
                  )
              }
            })
          }
        }
      )
    }

    items.push(
      {
        id: 'copy-path',
        label: 'Копировать путь',
        onClick: () => {
          void navigator.clipboard.writeText(entry.path)
          addToast('Путь скопирован', 'success')
        }
      },
      {
        id: 'rename',
        label: 'Переименовать',
        onClick: () => {
          openNamePrompt({
            title: 'Переименовать',
            defaultValue: entry.name,
            confirmLabel: 'Сохранить',
            onConfirm: (newName) => {
              if (!isValidEntryName(newName)) {
                addToast('Недопустимое имя', 'error')
                return
              }
              if (newName === entry.name) return
              void window.api.fs
                .rename(entry.path, newName)
                .then((newPath) => {
                  renameTabPath(entry.path, newPath)
                  refresh()
                  addToast('Переименовано', 'success')
                })
                .catch((err) =>
                  addToast(err instanceof Error ? err.message : 'Не удалось переименовать', 'error')
                )
            }
          })
        }
      },
      {
        id: 'reveal',
        label: 'Показать в проводнике',
        onClick: () => {
          void window.api.fs.revealInExplorer(entry.path).catch((err) =>
            addToast(err instanceof Error ? err.message : 'Не удалось открыть проводник', 'error')
          )
        }
      },
      {
        id: 'refresh',
        label: 'Обновить',
        onClick: refresh
      }
    )

    const isWorkspaceRoot = entry.path === workingDirectory
    if (!isWorkspaceRoot) {
      items.push({
        id: 'delete',
        label: 'Удалить',
        danger: true,
        onClick: () => {
          const confirmed = window.confirm(
            `Удалить "${entry.name}"?${entry.isDirectory ? ' Папка и всё содержимое будут удалены.' : ''}`
          )
          if (!confirmed) return
          void window.api.fs
            .delete(entry.path)
            .then(() => {
              closeTabsUnderPath(entry.path)
              refresh()
              addToast('Удалено', 'success')
            })
            .catch((err) =>
              addToast(err instanceof Error ? err.message : 'Не удалось удалить', 'error')
            )
        }
      })
    }

    return items
  }

  return (
    <div className="flex h-full flex-col border-r border-white/5 bg-[#0d0d14]">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Explorer
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={refresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleOpenFolder}>
            <FolderOpen className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1" onContextMenu={handleWorkspaceContextMenu}>
          {!workingDirectory ? (
            <button
              type="button"
              onClick={handleOpenFolder}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 p-6 text-center hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
            >
              <FolderOpen className="h-8 w-8 text-indigo-400/50" />
              <span className="text-xs text-zinc-500">Open a project folder</span>
              <span className="text-[10px] text-zinc-600">Not the agent app folder</span>
            </button>
          ) : (
            rootEntries.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                refreshKey={refreshKey}
                expandPath={expandPath}
                onExpandHandled={() => setExpandPath(null)}
                onFileClick={handleFileClick}
                onContextMenu={handleContextMenu}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {menu && (
        <ExplorerContextMenu
          x={menu.x}
          y={menu.y}
          items={buildMenuItems(menu.entry)}
          onClose={() => setMenu(null)}
        />
      )}

      <NameInputDialog
        open={namePrompt !== null}
        title={namePrompt?.title ?? ''}
        defaultValue={namePrompt?.defaultValue ?? ''}
        confirmLabel={namePrompt?.confirmLabel}
        onConfirm={(name) => namePrompt?.onConfirm(name)}
        onOpenChange={(open) => {
          if (!open) setNamePrompt(null)
        }}
      />
    </div>
  )
}
