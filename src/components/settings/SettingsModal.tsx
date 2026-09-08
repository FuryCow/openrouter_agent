import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { McpSettingsPanel } from './McpSettingsPanel'
import { ProjectMemorySettings } from './ProjectMemorySettings'
import {
  getSettingsSection,
  getSettingsSections,
  type SettingsSection
} from '@/lib/settingsSections'
import { cn } from '@/lib/utils'

const SEARCH_PROVIDER_VALUES: AppSettings['searchProvider'][] = ['duckduckgo', 'tavily', 'brave']

function SettingsSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  disabled?: boolean
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm text-zinc-200">{title}</p>
        <p className="text-[11px] text-zinc-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

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
    setProjectMemoryEnabled: (v: boolean) => void
    setProjectMemoryAutoLoadDocs: (v: boolean) => void
    setAgentAutoVerify: (v: boolean) => void
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
  setters.setProjectMemoryEnabled(settings.projectMemoryEnabled !== false)
  setters.setProjectMemoryAutoLoadDocs(settings.projectMemoryAutoLoadDocs !== false)
  setters.setAgentAutoVerify(settings.agentAutoVerify !== false)
}

export function SettingsModal(): React.ReactElement {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { settings, settingsOpen, settingsFocusSection, setSettingsOpen, setSettings, loadModels } =
    useSettingsStore()
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings)
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
  const [projectMemoryEnabled, setProjectMemoryEnabled] = useState(
    settings.projectMemoryEnabled !== false
  )
  const [projectMemoryAutoLoadDocs, setProjectMemoryAutoLoadDocs] = useState(
    settings.projectMemoryAutoLoadDocs !== false
  )
  const [agentAutoVerify, setAgentAutoVerify] = useState(settings.agentAutoVerify !== false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!settingsOpen) return
    setActiveSection(settingsFocusSection ?? 'general')

    void window.api.settings.get().then((loaded) => {
      setSettings(loaded)
      setDraftSettings(loaded)
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
        setSemanticSearchEnabled,
        setProjectMemoryEnabled,
        setProjectMemoryAutoLoadDocs,
        setAgentAutoVerify
      })
    })
  }, [settingsOpen, settingsFocusSection, setSettings])

  const handleOpen = (open: boolean): void => {
    if (!open) setSaveError('')
    setSettingsOpen(open)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setSaveError('')
    try {
      const newSettings = {
        ...draftSettings,
        apiKey,
        temperature: Number(temperature) || 0.7,
        customSystemPrompt,
        autoApproveWrites,
        autoApproveTerminal,
        searchApiKey,
        searchProvider,
        indexOnOpen,
        maxFileSizeKb: Number(maxFileSizeKb) || 1024,
        semanticSearchEnabled,
        projectMemoryEnabled,
        projectMemoryAutoLoadDocs,
        agentAutoVerify
      }
      await window.api.settings.save(newSettings)
      setSettings(newSettings)
      await loadModels()
      setSettingsOpen(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const providerLabel =
    searchProvider === 'duckduckgo'
      ? t('search.duckduckgo')
      : searchProvider === 'tavily'
        ? t('search.tavily')
        : searchProvider === 'brave'
          ? t('search.brave')
          : t('search.selectProvider')
  const sectionMeta = getSettingsSection(activeSection, t)
  const settingsSections = getSettingsSections(t)

  const renderSectionContent = (): React.ReactElement => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                {t('general.apiKey')}
              </label>
              <PasswordInput value={apiKey} onChange={setApiKey} placeholder={t('general.apiKeyPlaceholder')} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">{t('general.temperature')}</label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="input-field max-w-xs"
              />
              <p className="mt-1 text-[11px] text-zinc-500">{t('general.temperatureHint')}</p>
            </div>
          </div>
        )

      case 'agent':
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                {t('agent.customPrompt')}
              </label>
              <textarea
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                rows={4}
                placeholder={t('agent.customPromptPlaceholder')}
                className="input-field"
              />
            </div>
            <ProjectMemorySettings
              enabled={projectMemoryEnabled}
              autoLoadDocs={projectMemoryAutoLoadDocs}
              onEnabledChange={setProjectMemoryEnabled}
              onAutoLoadDocsChange={setProjectMemoryAutoLoadDocs}
            />
            <SettingsSwitchRow
              title={t('agent.verifyAfterEdits.title')}
              description={t('agent.verifyAfterEdits.description')}
              checked={agentAutoVerify}
              onCheckedChange={setAgentAutoVerify}
            />
          </div>
        )

      case 'safety':
        return (
          <div className="space-y-2">
            <SettingsSwitchRow
              title={t('safety.autoApproveWrites.title')}
              description={t('safety.autoApproveWrites.description')}
              checked={autoApproveWrites}
              onCheckedChange={setAutoApproveWrites}
            />
            <SettingsSwitchRow
              title={t('safety.autoApproveTerminal.title')}
              description={t('safety.autoApproveTerminal.description')}
              checked={autoApproveTerminal}
              onCheckedChange={setAutoApproveTerminal}
            />
          </div>
        )

      case 'search':
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">{t('search.provider')}</label>
              <Select
                value={searchProvider}
                onValueChange={(v) => setSearchProvider(v as AppSettings['searchProvider'])}
              >
                <SelectTrigger className="h-10 w-full max-w-md text-sm">
                  <SelectValue placeholder={t('search.selectProvider')}>{providerLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_PROVIDER_VALUES.map((provider) => (
                    <SelectItem key={provider} value={provider!} className="py-2 text-sm">
                      {provider === 'duckduckgo'
                        ? t('search.duckduckgo')
                        : provider === 'tavily'
                          ? t('search.tavily')
                          : t('search.brave')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {searchProvider !== 'duckduckgo' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">{t('search.apiKey')}</label>
                <PasswordInput
                  value={searchApiKey}
                  onChange={setSearchApiKey}
                  placeholder={t('search.apiKeyPlaceholder')}
                />
              </div>
            )}
          </div>
        )

      case 'index':
        return (
          <div className="space-y-4">
            <SettingsSwitchRow
              title={t('index.onOpen.title')}
              description={t('index.onOpen.description')}
              checked={indexOnOpen}
              onCheckedChange={setIndexOnOpen}
            />
            <SettingsSwitchRow
              title={t('index.semantic.title')}
              description={t('index.semantic.description')}
              checked={semanticSearchEnabled}
              onCheckedChange={setSemanticSearchEnabled}
            />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">{t('index.maxFileSize')}</label>
              <input
                type="number"
                min="64"
                max="8192"
                value={maxFileSizeKb}
                onChange={(e) => setMaxFileSizeKb(e.target.value)}
                className="input-field max-w-xs"
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => void window.api.index.rebuild()}>
              {t('index.rebuild')}
            </Button>
          </div>
        )

      case 'mcp':
        return (
          <McpSettingsPanel
            settings={draftSettings}
            onSettingsChange={setDraftSettings}
            embedded
            initialTab={settingsFocusSection === 'mcp' ? 'servers' : undefined}
          />
        )

      default:
        return <div />
    }
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={handleOpen}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-white/5 px-6 py-4">
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <nav className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/5 bg-black/20 p-3">
            {settingsSections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-100 ring-1 ring-indigo-400/20'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="text-xs font-medium">{section.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-white/5 px-6 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">{sectionMeta.label}</h2>
              <p className="mt-0.5 text-xs text-zinc-500">{sectionMeta.description}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{renderSectionContent()}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/5 px-6 py-4">
          <div>{saveError && <p className="text-xs text-red-400">{saveError}</p>}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? tCommon('actions.saving') : tCommon('actions.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
