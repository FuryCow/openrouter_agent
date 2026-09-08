import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { File } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUiStore } from '@/stores/uiStore'
import { useFileStore } from '@/stores/fileStore'
import { useWorkspace } from '@/hooks/useWorkspace'
import { cn } from '@/lib/utils'

function scorePath(path: string, query: string): number {
  const lowerPath = path.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const fileName = path.split(/[/\\]/).pop()?.toLowerCase() ?? ''

  if (fileName === lowerQuery) return 1000
  if (fileName.startsWith(lowerQuery)) return 800
  if (fileName.includes(lowerQuery)) return 600
  if (lowerPath.includes(lowerQuery)) return 400

  const parts = lowerQuery.split(/\s+/).filter(Boolean)
  if (parts.length > 1 && parts.every((part) => lowerPath.includes(part))) return 300
  return 0
}

export function QuickOpenModal(): React.ReactElement {
  const { t } = useTranslation('layout')
  const open = useUiStore((s) => s.quickOpenOpen)
  const setOpen = useUiStore((s) => s.setQuickOpenOpen)
  const openFile = useFileStore((s) => s.openFile)
  const { workingDirectory, openFolderPicker } = useWorkspace()
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

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
      .then((paths) => setFiles(paths.filter((p) => !p.endsWith('/') && !p.endsWith('\\'))))
      .finally(() => setLoading(false))

    return () => cancelAnimationFrame(frame)
  }, [open, workingDirectory])

  const results = useMemo(() => {
    const trimmed = query.trim()
    const ranked = files
      .map((path) => ({ path, score: trimmed ? scorePath(path, trimmed) : 1 }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, 50)
    return ranked
  }, [files, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, results.length])

  const openPath = async (path: string): Promise<void> => {
    const content = await window.api.fs.readFile(path)
    openFile(path, content)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      void openPath(results[activeIndex].path)
    }
  }

  const workspaceLabel = workingDirectory?.split(/[/\\]/).pop() ?? null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="border-b border-white/5 px-4 py-3">
          <DialogTitle className="text-base">{t('quickOpen.title')}</DialogTitle>
        </DialogHeader>

        <div className="border-b border-white/5 px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              workingDirectory ? t('quickOpen.placeholder') : t('quickOpen.noWorkspacePlaceholder')
            }
            disabled={!workingDirectory}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
          {workspaceLabel && (
            <p className="mt-2 text-[10px] text-zinc-600">
              {t('quickOpen.project', { name: workspaceLabel })}
            </p>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {!workingDirectory ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-zinc-500">{t('quickOpen.noFolder')}</p>
              <button
                type="button"
                onClick={() => void openFolderPicker()}
                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/15"
              >
                {t('quickOpen.openFolder')}
              </button>
            </div>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t('quickOpen.loading')}</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t('quickOpen.noResults')}</p>
          ) : (
            results.map((item, index) => {
              const name = item.path.split(/[/\\]/).pop() ?? item.path
              const dir = item.path.slice(0, item.path.length - name.length)
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => void openPath(item.path)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                    index === activeIndex ? 'bg-indigo-500/15 text-zinc-100' : 'hover:bg-white/5 text-zinc-300'
                  )}
                >
                  <File className="h-4 w-4 shrink-0 text-zinc-500" />
                  <div className="min-w-0">
                    <div className="truncate text-sm">{name}</div>
                    <div className="truncate text-[10px] text-zinc-600">{dir}</div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
