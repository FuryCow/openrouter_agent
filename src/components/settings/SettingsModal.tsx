import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { ModelPicker } from '../models/ModelPicker'
import { useSettingsStore } from '@/stores/settingsStore'
import type { ChatMode } from '@/types'

export function SettingsModal(): React.ReactElement {
  const {
    settings,
    models,
    modelsLoading,
    modelsError,
    settingsOpen,
    setSettingsOpen,
    setSettings,
    loadModels
  } = useSettingsStore()
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [model, setModel] = useState(settings.model)
  const [temperature, setTemperature] = useState(String(settings.temperature ?? 0.7))
  const [maxTokens, setMaxTokens] = useState(String(settings.maxTokens ?? 4096))
  const [customSystemPrompt, setCustomSystemPrompt] = useState(settings.customSystemPrompt ?? '')
  const [autoApproveWrites, setAutoApproveWrites] = useState(settings.autoApproveWrites ?? false)
  const [autoApproveTerminal, setAutoApproveTerminal] = useState(settings.autoApproveTerminal ?? false)
  const [searchApiKey, setSearchApiKey] = useState(settings.searchApiKey ?? '')
  const [searchProvider, setSearchProvider] = useState(settings.searchProvider ?? 'duckduckgo')
  const [modelsByMode, setModelsByMode] = useState(settings.modelsByMode ?? {})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const handleOpen = (open: boolean): void => {
    if (open) {
      setApiKey(settings.apiKey)
      setModel(settings.model)
      setTemperature(String(settings.temperature ?? 0.7))
      setMaxTokens(String(settings.maxTokens ?? 4096))
      setCustomSystemPrompt(settings.customSystemPrompt ?? '')
      setAutoApproveWrites(settings.autoApproveWrites ?? false)
      setAutoApproveTerminal(settings.autoApproveTerminal ?? false)
      setSearchApiKey(settings.searchApiKey ?? '')
      setSearchProvider(settings.searchProvider ?? 'duckduckgo')
      setModelsByMode(settings.modelsByMode ?? {})
      setSaveError('')
      void loadModels()
    }
    setSettingsOpen(open)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setSaveError('')
    try {
      const newSettings = {
        ...settings,
        apiKey,
        model,
        temperature: Number(temperature) || 0.7,
        maxTokens: Number(maxTokens) || 4096,
        customSystemPrompt,
        autoApproveWrites,
        autoApproveTerminal,
        searchApiKey,
        searchProvider,
        modelsByMode
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

  const setModeModel = (mode: ChatMode, value: string): void => {
    setModelsByMode((prev) => ({ ...prev, [mode]: value }))
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={handleOpen}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
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
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Default Model</label>
              <ModelPicker
                value={model}
                models={models}
                loading={modelsLoading}
                onChange={setModel}
                onRefresh={loadModels}
              />
              {modelsError && <p className="mt-1.5 text-[10px] text-amber-400">{modelsError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Max tokens</label>
                <input
                  type="number"
                  min="256"
                  max="128000"
                  step="256"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Per-mode models</h3>
            {(['agent', 'ask', 'planner'] as ChatMode[]).map((mode) => (
              <div key={mode}>
                <label className="mb-1 block text-xs text-zinc-500 capitalize">{mode}</label>
                <ModelPicker
                  value={modelsByMode[mode] || model}
                  models={models}
                  loading={modelsLoading}
                  onChange={(v) => setModeModel(mode, v)}
                  onRefresh={loadModels}
                />
              </div>
            ))}
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

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Safety</h3>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={autoApproveWrites}
                onChange={(e) => setAutoApproveWrites(e.target.checked)}
              />
              Auto-approve write_file / search_replace
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={autoApproveTerminal}
                onChange={(e) => setAutoApproveTerminal(e.target.checked)}
              />
              Auto-approve run_terminal
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Web search</h3>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Provider</label>
              <select
                value={searchProvider}
                onChange={(e) => setSearchProvider(e.target.value as 'duckduckgo' | 'tavily' | 'brave')}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
              >
                <option value="duckduckgo">DuckDuckGo (no key)</option>
                <option value="tavily">Tavily</option>
                <option value="brave">Brave Search</option>
              </select>
            </div>
            {searchProvider !== 'duckduckgo' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Search API key</label>
                <input
                  type="password"
                  value={searchApiKey}
                  onChange={(e) => setSearchApiKey(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
                />
              </div>
            )}
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
