import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { PasswordInput } from '../ui/password-input'
import { Switch } from '../ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { useSettingsStore } from '@/stores/settingsStore'
import type { AppSettings } from '@/types'

const SEARCH_PROVIDERS: Array<{ value: AppSettings['searchProvider']; label: string }> = [
  { value: 'duckduckgo', label: 'DuckDuckGo (no key)' },
  { value: 'tavily', label: 'Tavily' },
  { value: 'brave', label: 'Brave Search' }
]

function syncFormFromSettings(
  settings: AppSettings,
  setters: {
    setApiKey: (v: string) => void
    setTemperature: (v: string) => void
    setCustomSystemPrompt: (v: string) => void
    setAutoApproveWrites: (v: boolean) => void
    setAutoApproveTerminal: (v: boolean) => void
    setSearchApiKey: (v: string) => void
    setSearchProvider: (v: AppSettings['searchProvider']) => void
    setIndexOnOpen: (v: boolean) => void
    setMaxFileSizeKb: (v: string) => void
    setSemanticSearchEnabled: (v: boolean) => void
  }
): void {
  setters.setApiKey(settings.apiKey ?? '')
  setters.setTemperature(String(settings.temperature ?? 0.7))
  setters.setCustomSystemPrompt(settings.customSystemPrompt ?? '')
  setters.setAutoApproveWrites(settings.autoApproveWrites ?? false)
  setters.setAutoApproveTerminal(settings.autoApproveTerminal ?? false)
  setters.setSearchApiKey(settings.searchApiKey ?? '')
  setters.setSearchProvider(settings.searchProvider ?? 'duckduckgo')
  setters.setIndexOnOpen(settings.indexOnOpen ?? true)
  setters.setMaxFileSizeKb(String(settings.maxFileSizeKb ?? 1024))
  setters.setSemanticSearchEnabled(settings.semanticSearchEnabled ?? true)
}

export function SettingsModal(): React.ReactElement {
  const { settings, settingsOpen, setSettingsOpen, setSettings, loadModels } = useSettingsStore()
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [temperature, setTemperature] = useState(String(settings.temperature ?? 0.7))
  const [customSystemPrompt, setCustomSystemPrompt] = useState(settings.customSystemPrompt ?? '')
  const [autoApproveWrites, setAutoApproveWrites] = useState(settings.autoApproveWrites ?? false)
  const [autoApproveTerminal, setAutoApproveTerminal] = useState(settings.autoApproveTerminal ?? false)
  const [searchApiKey, setSearchApiKey] = useState(settings.searchApiKey ?? '')
  const [searchProvider, setSearchProvider] = useState<AppSettings['searchProvider']>(
    settings.searchProvider ?? 'duckduckgo'
  )
  const [indexOnOpen, setIndexOnOpen] = useState(settings.indexOnOpen ?? true)
  const [maxFileSizeKb, setMaxFileSizeKb] = useState(String(settings.maxFileSizeKb ?? 1024))
  const [semanticSearchEnabled, setSemanticSearchEnabled] = useState(
    settings.semanticSearchEnabled ?? true
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!settingsOpen) return

    void window.api.settings.get().then((loaded) => {
      setSettings(loaded)
      syncFormFromSettings(loaded, {
        setApiKey,
        setTemperature,
        setCustomSystemPrompt,
        setAutoApproveWrites,
        setAutoApproveTerminal,
        setSearchApiKey,
        setSearchProvider,
        setIndexOnOpen,
        setMaxFileSizeKb,
        setSemanticSearchEnabled
      })
    })
  }, [settingsOpen, setSettings])

  const handleOpen = (open: boolean): void => {
    if (!open) setSaveError('')
    setSettingsOpen(open)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setSaveError('')
    try {
      const newSettings = {
        ...settings,
        apiKey,
        temperature: Number(temperature) || 0.7,
        customSystemPrompt,
        autoApproveWrites,
        autoApproveTerminal,
        searchApiKey,
        searchProvider,
        indexOnOpen,
        maxFileSizeKb: Number(maxFileSizeKb) || 1024,
        semanticSearchEnabled
      }
      await window.api.settings.save(newSettings)
      setSettings(newSettings)
      await loadModels()
      setSettingsOpen(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const providerLabel =
    SEARCH_PROVIDERS.find((p) => p.value === searchProvider)?.label ?? 'Select provider'

  return (
    <Dialog open={settingsOpen} onOpenChange={handleOpen}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">General</h3>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                OpenRouter API Key
              </label>
              <PasswordInput
                value={apiKey}
                onChange={setApiKey}
                placeholder="sk-or-..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Temperature</label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Agent</h3>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Custom system prompt (agent mode)
              </label>
              <textarea
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                rows={3}
                placeholder="Optional extra instructions prepended to agent system prompt"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
              />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Safety</h3>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">Auto-approve file writes</p>
                <p className="text-[11px] text-zinc-500">write_file / search_replace</p>
              </div>
              <Switch checked={autoApproveWrites} onCheckedChange={setAutoApproveWrites} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">Auto-approve terminal</p>
                <p className="text-[11px] text-zinc-500">run_terminal commands</p>
              </div>
              <Switch checked={autoApproveTerminal} onCheckedChange={setAutoApproveTerminal} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Web search</h3>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Provider</label>
              <Select
                value={searchProvider}
                onValueChange={(v) => setSearchProvider(v as AppSettings['searchProvider'])}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue placeholder="Select provider">{providerLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value!} className="text-sm py-2">
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {searchProvider !== 'duckduckgo' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Search API key</label>
                <PasswordInput value={searchApiKey} onChange={setSearchApiKey} placeholder="API key" />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Codebase Index</h3>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">Index on folder open</p>
                <p className="text-[11px] text-zinc-500">Background FTS + symbols + embeddings</p>
              </div>
              <Switch checked={indexOnOpen} onCheckedChange={setIndexOnOpen} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">Semantic search</p>
                <p className="text-[11px] text-zinc-500">Local MiniLM embeddings (offline)</p>
              </div>
              <Switch checked={semanticSearchEnabled} onCheckedChange={setSemanticSearchEnabled} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Max file size (KB)</label>
              <input
                type="number"
                min="64"
                max="8192"
                value={maxFileSizeKb}
                onChange={(e) => setMaxFileSizeKb(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void window.api.index.rebuild()}
            >
              Rebuild index
            </Button>
          </section>

          {saveError && <p className="text-xs text-red-400">{saveError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
