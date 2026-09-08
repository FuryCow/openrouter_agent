import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  RefreshCw
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { FileIcon } from '../ui/FileIcon'
import { ScrollArea } from '../ui/scroll-area'
import { ExplorerContextMenu, type ContextMenuItem } from './ExplorerContextMenu'
import { NameInputDialog } from './NameInputDialog'
import { loadFileForEditor } from '@/lib/loadFileForEditor'
import { useFileStore } from '@/stores/fileStore'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useToastStore } from '@/stores/toastStore'
import { getFileName, cn } from '@/lib/utils'
import type { DirEntry } from '@/types'

function isValidEntryName(name: string): boolean {
  return name.length > 0 && !/[\\/<>:"|?*]/.test(name)
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
  kind: 'entry' | 'background'
}

interface NamePromptState {
  title: string
  defaultValue: string
  confirmLabel?: string
  onConfirm: (name: string) => void
}

export function FileExplorer(): React.ReactElement {
  const { t } = useTranslation('explorer')
  const { t: tCommon } = useTranslation('common')
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const setWorkingDirectory = useFileStore((s) => s.setWorkingDirectory)
  const openFile = useFileStore((s) => s.openFile)
  const closeTabsUnderPath = useFileStore((s) => s.closeTabsUnderPath)
  const renameTabPath = useFileStore((s) => s.renameTabPath)
  const { openFolderPicker } = useWorkspace()
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
      addToast(err instanceof Error ? err.message : t('workspaceNotAllowed'), 'error')
    }
  }, [workingDirectory, setWorkingDirectory, addToast, t])

  useEffect(() => {
    loadRoot()
  }, [loadRoot, refreshKey])

  useEffect(() => {
    if (!workingDirectory) return
    return window.api.fs.onWorkspaceChanged(() => refresh())
  }, [workingDirectory, refresh])

  const handleOpenFolder = (): void => {
    void openFolderPicker()
  }

  const handleFileClick = async (path: string): Promise<void> => {
    const content = await loadFileForEditor(path)
    openFile(path, content)
  }

  const openNamePrompt = (config: NamePromptState): void => {
    setMenu(null)
    setNamePrompt(config)
  }

  const workspaceEntry = workingDirectory
    ? {
        name: workingDirectory.split(/[/\\]/).pop() || workingDirectory,
        path: workingDirectory,
        isDirectory: true
      }
    : null

  const promptCreateFile = (directoryPath: string): void => {
    openNamePrompt({
      title: t('newFile'),
      defaultValue: t('defaultFileName'),
      confirmLabel: tCommon('actions.create'),
      onConfirm: (name) => {
        if (!isValidEntryName(name)) {
          addToast(t('invalidFileName'), 'error')
          return
        }
        void window.api.fs
          .createFile(directoryPath, name)
          .then((path) => {
            setExpandPath(directoryPath)
            refresh()
            addToast(tCommon('toast.fileCreated', { name }), 'success')
            return handleFileClick(path)
          })
          .catch((err) =>
            addToast(err instanceof Error ? err.message : t('createFileFailed'), 'error')
          )
      }
    })
  }

  const promptCreateFolder = (directoryPath: string): void => {
    openNamePrompt({
      title: t('newFolder'),
      defaultValue: t('defaultFolderName'),
      confirmLabel: tCommon('actions.create'),
      onConfirm: (name) => {
        if (!isValidEntryName(name)) {
          addToast(t('invalidFolderName'), 'error')
          return
        }
        void window.api.fs
          .createDirectory(directoryPath, name)
          .then(() => {
            setExpandPath(directoryPath)
            refresh()
            addToast(tCommon('toast.folderCreated', { name }), 'success')
          })
          .catch((err) =>
            addToast(err instanceof Error ? err.message : t('createFolderFailed'), 'error')
          )
      }
    })
  }

  const handleContextMenu = (event: React.MouseEvent, entry: DirEntry): void => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, entry, kind: 'entry' })
  }

  const handleBackgroundContextMenu = (event: React.MouseEvent): void => {
    if (!workspaceEntry) return
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    setMenu({
      x: event.clientX,
      y: event.clientY,
      entry: workspaceEntry,
      kind: 'background'
    })
  }

  const buildBackgroundMenuItems = (directory: DirEntry): ContextMenuItem[] => [
    {
      id: 'new-file',
      label: t('newFile'),
      onClick: () => promptCreateFile(directory.path)
    },
    {
      id: 'new-folder',
      label: t('newFolder'),
      onClick: () => promptCreateFolder(directory.path)
    },
    {
      id: 'refresh',
      label: tCommon('actions.refresh'),
      onClick: refresh
    }
  ]

  const buildMenuItems = (entry: DirEntry): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []

    if (!entry.isDirectory) {
      items.push({
        id: 'open',
        label: tCommon('actions.open'),
        onClick: () => {
          void handleFileClick(entry.path)
        }
      })
    }

    if (entry.isDirectory) {
      items.push(
        {
          id: 'new-file',
          label: t('newFile'),
          onClick: () => promptCreateFile(entry.path)
        },
        {
          id: 'new-folder',
          label: t('newFolder'),
          onClick: () => promptCreateFolder(entry.path)
        }
      )
    }

    items.push(
      {
        id: 'copy-path',
        label: t('copyPath'),
        onClick: () => {
          void navigator.clipboard.writeText(entry.path)
          addToast(tCommon('toast.pathCopied'), 'success')
        }
      },
      {
        id: 'rename',
        label: t('rename'),
        onClick: () => {
          openNamePrompt({
            title: t('rename'),
            defaultValue: entry.name,
            confirmLabel: t('save'),
            onConfirm: (newName) => {
              if (!isValidEntryName(newName)) {
                addToast(t('invalidName'), 'error')
                return
              }
              if (newName === entry.name) return
              void window.api.fs
                .rename(entry.path, newName)
                .then((newPath) => {
                  renameTabPath(entry.path, newPath)
                  refresh()
                  addToast(tCommon('toast.renamed'), 'success')
                })
                .catch((err) =>
                  addToast(err instanceof Error ? err.message : t('renameFailed'), 'error')
                )
            }
          })
        }
      },
      {
        id: 'reveal',
        label: t('revealInExplorer'),
        onClick: () => {
          void window.api.fs.revealInExplorer(entry.path).catch((err) =>
            addToast(err instanceof Error ? err.message : t('revealFailed'), 'error')
          )
        }
      },
      {
        id: 'refresh',
        label: tCommon('actions.refresh'),
        onClick: refresh
      }
    )

    const isWorkspaceRoot = entry.path === workingDirectory
    if (!isWorkspaceRoot) {
      items.push({
        id: 'delete',
        label: tCommon('actions.delete'),
        danger: true,
        onClick: () => {
          const confirmed = window.confirm(
            t('deleteConfirm', {
              name: entry.name,
              folderSuffix: entry.isDirectory ? t('deleteFolderSuffix') : ''
            })
          )
          if (!confirmed) return
          void window.api.fs
            .delete(entry.path)
            .then(() => {
              closeTabsUnderPath(entry.path)
              refresh()
              addToast(tCommon('toast.deleted'), 'success')
            })
            .catch((err) =>
              addToast(err instanceof Error ? err.message : t('deleteFailed'), 'error')
            )
        }
      })
    }

    return items
  }

  return (
    <div className="flex h-full flex-col border-r border-white/5 bg-[#0d0d14]">
      <div className="border-b border-white/5 px-2 py-2">
        <button
          type="button"
          onClick={handleOpenFolder}
          className="w-full min-w-0 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/5"
          title={workingDirectory || t('openProjectFolder')}
        >
          <div className="flex items-center gap-1.5">
            <FolderOpen
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                workingDirectory ? 'text-indigo-400' : 'text-indigo-400/40'
              )}
            />
            <span
              className={cn(
                'truncate text-sm font-medium leading-tight',
                workingDirectory ? 'text-zinc-100' : 'text-zinc-500'
              )}
            >
              {workingDirectory ? getFileName(workingDirectory) : t('openProjectFolder')}
            </span>
          </div>
          {workingDirectory && (
            <p className="mt-0.5 truncate pl-5 text-[10px] leading-tight text-zinc-600">
              {workingDirectory}
            </p>
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1" onContextMenu={handleBackgroundContextMenu}>
        <ScrollArea className="h-full">
          <div className="min-h-full p-1">
          {!workingDirectory ? (
            <button
              type="button"
              onClick={handleOpenFolder}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 p-6 text-center hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
            >
              <FolderOpen className="h-8 w-8 text-indigo-400/50" />
              <span className="text-xs text-zinc-500">{t('openProjectFolder')}</span>
              <span className="text-[10px] text-zinc-600">{t('notAgentFolder')}</span>
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
      </div>

      {menu && (
        <ExplorerContextMenu
          x={menu.x}
          y={menu.y}
          items={
            menu.kind === 'background'
              ? buildBackgroundMenuItems(menu.entry)
              : buildMenuItems(menu.entry)
          }
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
