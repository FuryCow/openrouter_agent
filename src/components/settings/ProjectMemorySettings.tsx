import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { useFileStore } from '@/stores/fileStore'
import type { ProjectMemoryEntry } from '@/types'
import { cn } from '@/lib/utils'

function formatEntryLine(entry: ProjectMemoryEntry): string {
  return `[${entry.category}] ${entry.content.replace(/\n/g, ' ')}`
}

function parseEntryLines(raw: string, existing: ProjectMemoryEntry[]): ProjectMemoryEntry[] {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line, index) => {
    const match = line.match(/^\[(architecture|decision|bug|convention|note)\]\s+(.*)$/)
    const category = (match?.[1] ?? 'note') as ProjectMemoryEntry['category']
    const content = (match?.[2] ?? line).trim()
    const previous = existing[index]
    return {
      id: previous?.id ?? crypto.randomUUID(),
      category,
      content,
      source: previous?.source ?? 'user',
      createdAt: previous?.createdAt ?? new Date().toISOString()
    }
  })
}

export function ProjectMemorySettings({
  enabled,
  autoLoadDocs,
  onEnabledChange,
  onAutoLoadDocsChange
}: {
  enabled: boolean
  autoLoadDocs: boolean
  onEnabledChange: (value: boolean) => void
  onAutoLoadDocsChange: (value: boolean) => void
}): React.ReactElement {
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const [snapshot, setSnapshot] = useState('')
  const [entriesText, setEntriesText] = useState('')
  const [existingEntries, setExistingEntries] = useState<ProjectMemoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [showEditor, setShowEditor] = useState(false)

  useEffect(() => {
    if (!workingDirectory) {
      setSnapshot('')
      setEntriesText('')
      setExistingEntries([])
      return
    }

    setLoading(true)
    setStatus('')
    void Promise.all([
      window.api.memory.getSnapshot(workingDirectory),
      window.api.memory.listEntries(workingDirectory)
    ])
      .then(([nextSnapshot, entries]) => {
        setSnapshot(nextSnapshot)
        setExistingEntries(entries)
        setEntriesText(entries.map(formatEntryLine).join('\n'))
      })
      .catch((err) => {
        setStatus(err instanceof Error ? err.message : 'Failed to load project memory')
      })
      .finally(() => setLoading(false))
  }, [workingDirectory, enabled, autoLoadDocs])

  const handleSaveEntries = async (): Promise<void> => {
    if (!workingDirectory) return
    setSaving(true)
    setStatus('')
    try {
      const parsed = parseEntryLines(entriesText, existingEntries)
      const saved = await window.api.memory.saveEntries(parsed, workingDirectory)
      setExistingEntries(saved)
      setEntriesText(saved.map(formatEntryLine).join('\n'))
      const nextSnapshot = await window.api.memory.getSnapshot(workingDirectory)
      setSnapshot(nextSnapshot)
      setStatus('Memory saved')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save memory')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-zinc-200">Project memory</p>
          <p className="text-[11px] text-zinc-500">Persistent workspace context for agent mode</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-zinc-200">Load AGENTS.md / .openrouter/*.md</p>
          <p className="text-[11px] text-zinc-500">Git-friendly docs from the workspace</p>
        </div>
        <Switch checked={autoLoadDocs} onCheckedChange={onAutoLoadDocsChange} disabled={!enabled} />
      </div>

      {!workingDirectory ? (
        <p className="text-[11px] text-zinc-500">Open a workspace to view or edit project memory.</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowEditor((open) => !open)}
            className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/[0.04]"
          >
            {showEditor ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            )}
            Manage memory entries
            {!loading && existingEntries.length > 0 && (
              <span className="ml-auto text-[10px] text-zinc-500">{existingEntries.length} entries</span>
            )}
          </button>

          {showEditor && (
            <div className="space-y-3 rounded-lg border border-white/5 bg-black/10 p-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Snapshot preview</label>
                <textarea
                  readOnly
                  value={loading ? 'Loading...' : snapshot}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Dynamic entries (one per line)
                </label>
                <textarea
                  value={entriesText}
                  onChange={(e) => setEntriesText(e.target.value)}
                  rows={5}
                  disabled={!enabled || loading}
                  placeholder="[decision] We use Zustand for UI state"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200"
                />
                <p className="mt-1 text-[10px] text-zinc-500">
                  Prefix with [architecture], [decision], [bug], [convention], or [note]. Create{' '}
                  <span className="text-zinc-400">AGENTS.md</span> or{' '}
                  <span className="text-zinc-400">.openrouter/rules.md</span> in the repo for shared rules.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!enabled || saving || loading}
                  onClick={() => void handleSaveEntries()}
                >
                  {saving ? 'Saving...' : 'Save memory'}
                </Button>
                {status && (
                  <span
                    className={cn(
                      'text-[11px]',
                      status === 'Memory saved' ? 'text-emerald-400' : 'text-zinc-500'
                    )}
                  >
                    {status}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
