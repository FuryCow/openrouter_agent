import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { useMcp } from '@/hooks/useMcp'
import type { AppSettings, McpServerConfig, McpTransportType } from '@/types'
import { cn } from '@/lib/utils'
import { parseCursorMcpJson, toCursorMcpJson, validateMcpServerConfigs } from '@/lib/mcp-config'

type McpTab = 'servers' | 'json' | 'policies'

type TestFeedback = { type: 'success' | 'error'; message: string }

function serverConfigsEqual(a: McpServerConfig[], b: McpServerConfig[] | undefined): boolean {
  return JSON.stringify(toCursorMcpJson(a)) === JSON.stringify(toCursorMcpJson(b ?? []))
}

const TRANSPORT_OPTIONS: Array<{ value: McpTransportType; label: string }> = [
  { value: 'stdio', label: 'stdio' },
  { value: 'streamable-http', label: 'streamable-http' },
  { value: 'sse', label: 'sse' }
]

const STATUS_COLORS: Record<string, string> = {
  connected: 'text-emerald-400',
  connecting: 'text-amber-400',
  error: 'text-red-400',
  disabled: 'text-zinc-500',
  unsaved: 'text-amber-400/90',
  'not connected': 'text-zinc-500'
}

function emptyServer(): McpServerConfig {
  return {
    id: `server-${Date.now()}`,
    name: 'New Server',
    enabled: true,
    transport: 'stdio',
    command: 'npx',
    args: [],
    env: {},
    headers: {}
  }
}

function formatEnvLines(env: Record<string, string> | undefined): string {
  return Object.entries(env ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

function parseEnvLines(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

interface McpSettingsPanelProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
  initialTab?: McpTab
  embedded?: boolean
}

export function McpSettingsPanel({
  settings,
  onSettingsChange,
  initialTab,
  embedded = false
}: McpSettingsPanelProps): React.ReactElement {
  const [tab, setTab] = useState<McpTab>(initialTab ?? 'servers')
  const [servers, setServers] = useState<McpServerConfig[]>(settings.mcpServers ?? [])
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testFeedback, setTestFeedback] = useState<Record<string, TestFeedback>>({})
  const { status, loading, error, saveConfig, importDefaultCursor, importFromFile, testServer, reconnect } =
    useMcp()

  const isDirty = !serverConfigsEqual(servers, settings.mcpServers)

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    setServers(settings.mcpServers ?? [])
  }, [settings.mcpServers])

  const cursorJson = useMemo(
    () => JSON.stringify(toCursorMcpJson(servers), null, 2),
    [servers]
  )

  useEffect(() => {
    if (tab === 'json') {
      setJsonText(cursorJson)
      setJsonError('')
    }
  }, [tab, cursorJson])

  const persistServers = async (next: McpServerConfig[]): Promise<void> => {
    setSaving(true)
    setActionError('')
    try {
      const validationError = validateMcpServerConfigs(next)
      if (validationError) throw new Error(validationError)
      await saveConfig(next)
      onSettingsChange({ ...settings, mcpServers: next })
      setServers(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save MCP config'
      setActionError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleTestServer = async (server: McpServerConfig): Promise<void> => {
    setTestingId(server.id)
    setActionError('')
    setTestFeedback((prev) => {
      const next = { ...prev }
      delete next[server.id]
      return next
    })

    try {
      const validationError = validateMcpServerConfigs([server])
      if (validationError) throw new Error(validationError)

      const result = await testServer(server)
      if (!result.ok) {
        const message = result.error ?? 'Test failed'
        setTestFeedback((prev) => ({
          ...prev,
          [server.id]: { type: 'error', message }
        }))
        return
      }

      await persistServers(servers)
      setTestFeedback((prev) => ({
        ...prev,
        [server.id]: {
          type: 'success',
          message: `Connected — ${result.toolCount} tools (saved)`
        }
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test failed'
      setTestFeedback((prev) => ({
        ...prev,
        [server.id]: { type: 'error', message }
      }))
    } finally {
      setTestingId(null)
    }
  }

  const handleSaveJson = async (): Promise<void> => {
    setJsonError('')
    try {
      const parsed = JSON.parse(jsonText) as { mcpServers?: Record<string, unknown> }
      if (!parsed.mcpServers) throw new Error('Missing mcpServers object')
      const next = parseCursorMcpJson(parsed)
      await persistServers(next)
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON')
    }
  }

  const updateServer = (id: string, patch: Partial<McpServerConfig>): void => {
    setServers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const removeServer = (id: string): void => {
    setServers((prev) => prev.filter((s) => s.id !== id))
  }

  const statusById = new Map(status.servers.map((s) => [s.id, s]))

  const Wrapper = embedded ? 'div' : 'section'

  return (
    <Wrapper className="space-y-3">
      <div className={cn('flex items-center justify-between gap-2', embedded && 'flex-wrap')}>
        {!embedded && (
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">MCP Servers</h3>
        )}
        <div className={cn('flex gap-1', embedded && 'w-full')}>
          {(['servers', 'json', 'policies'] as McpTab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs capitalize transition-colors',
                tab === value
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {(error || actionError) && (
        <p className="rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {actionError || error}
        </p>
      )}

      {tab === 'servers' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setServers((prev) => [...prev, emptyServer()])}
            >
              Add server
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() =>
                void importDefaultCursor()
                  .then(setServers)
                  .catch((err) => {
                    setActionError(err instanceof Error ? err.message : 'Import failed')
                  })
              }
            >
              Import Cursor
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() =>
                void importFromFile()
                  .then((next) => {
                    if (next) setServers(next)
                  })
                  .catch((err) => {
                    setActionError(err instanceof Error ? err.message : 'Import failed')
                  })
              }
            >
              Import file
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void reconnect()}>
              Reconnect all
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void persistServers(servers)}>
              {isDirty ? 'Save & connect' : 'Save'}
            </Button>
          </div>

          {isDirty && (
            <p className="text-xs text-amber-400/90">
              Unsaved changes — status bar updates after Save. Test will save automatically on success.
            </p>
          )}

          {loading && servers.length === 0 ? (
            <p className="text-xs text-zinc-500">Loading MCP servers…</p>
          ) : servers.length === 0 ? (
            <p className="text-xs text-zinc-500">No MCP servers configured.</p>
          ) : (
            <div className="space-y-2">
              {servers.map((server) => {
                const live = statusById.get(server.id)
                return (
                  <div
                    key={server.id}
                    className="space-y-2 rounded-lg border border-white/5 bg-white/[0.02] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={server.name ?? server.id}
                        onChange={(e) => updateServer(server.id, { name: e.target.value })}
                        className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-200"
                      />
                      <span className={cn('text-xs', STATUS_COLORS[live?.status ?? 'disabled'])}>
                        {live?.status ?? (isDirty ? 'unsaved' : 'not connected')}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {TRANSPORT_OPTIONS.find((t) => t.value === server.transport)?.label ?? server.transport} ·{' '}
                        {live?.toolCount ?? 0} tools
                      </span>
                      <Switch
                        checked={server.enabled}
                        onCheckedChange={(checked) => updateServer(server.id, { enabled: checked })}
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={server.id}
                        onChange={(e) => updateServer(server.id, { id: e.target.value })}
                        placeholder="id"
                        className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300"
                      />
                      <Select
                        value={server.transport}
                        onValueChange={(value) =>
                          updateServer(server.id, { transport: value as McpTransportType })
                        }
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSPORT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {server.transport === 'stdio' ? (
                      <div className="grid gap-2">
                        <input
                          value={server.command ?? ''}
                          onChange={(e) => updateServer(server.id, { command: e.target.value })}
                          placeholder="command"
                          className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300"
                        />
                        <input
                          value={(server.args ?? []).join(' ')}
                          onChange={(e) =>
                            updateServer(server.id, {
                              args: e.target.value.split(' ').filter(Boolean)
                            })
                          }
                          placeholder="args (space-separated)"
                          className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300"
                        />
                        <textarea
                          value={formatEnvLines(server.env)}
                          onChange={(e) =>
                            updateServer(server.id, { env: parseEnvLines(e.target.value) })
                          }
                          rows={2}
                          placeholder={'env (one per line)\nGITHUB_PERSONAL_ACCESS_TOKEN=ghp_...'}
                          className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300"
                        />
                      </div>
                    ) : (
                      <input
                        value={server.url ?? ''}
                        onChange={(e) => updateServer(server.id, { url: e.target.value })}
                        placeholder="https://example.com/mcp"
                        className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300"
                      />
                    )}

                    {live?.status === 'error' && live?.lastError && (
                      <p className="text-xs text-red-400">{live.lastError}</p>
                    )}

                    {live?.status === 'connected' && (
                      <p className="text-xs text-emerald-400/80">Connection OK</p>
                    )}

                    {testFeedback[server.id] && (
                      <p
                        className={cn(
                          'text-xs',
                          testFeedback[server.id].type === 'success'
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        )}
                      >
                        {testFeedback[server.id].message}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={testingId === server.id || saving}
                        onClick={() => void handleTestServer(server)}
                      >
                        {testingId === server.id ? 'Testing… (up to 2 min)' : 'Test & save'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeServer(server.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'json' && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-white/10">
            <Editor
              height="280px"
              language="json"
              theme="vs-dark"
              value={jsonText}
              onChange={(value) => setJsonText(value ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                scrollBeyondLastLine: false,
                wordWrap: 'on'
              }}
            />
          </div>
          {jsonError && <p className="text-xs text-red-400">{jsonError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setJsonText(cursorJson)}>
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(cursorJson)
              }}
            >
              Export copy
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void handleSaveJson()}>
              Save JSON
            </Button>
          </div>
        </div>
      )}

      {tab === 'policies' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3">
            <div>
              <p className="text-sm text-zinc-200">Require approval for MCP tools</p>
              <p className="text-xs text-zinc-500">
                Read-only MCP tools (get_, list_, search_, …) skip approval
              </p>
            </div>
            <Switch
              checked={settings.mcpRequireApproval !== false}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, mcpRequireApproval: checked })
              }
            />
          </div>

          <div className="space-y-2">
            {servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <span className="text-sm text-zinc-200">{server.name ?? server.id}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Auto-approve</span>
                  <Switch
                    checked={server.autoApprove === true}
                    onCheckedChange={(checked) => updateServer(server.id, { autoApprove: checked })}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button type="button" size="sm" disabled={saving} onClick={() => void persistServers(servers)}>
            Save policies
          </Button>
        </div>
      )}
    </Wrapper>
  )
}
