import { Minus, Search, Settings, Square, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { ModelPicker } from '../models/ModelPicker'
import { ModelVendorSelect } from '../models/ModelVendorSelect'
import { AppLogo } from '../brand/AppLogo'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'

export function TitleBar(): React.ReactElement {
  const { t } = useTranslation('layout')
  const { settings, models, modelsLoading, setSettings, setSettingsOpen, loadModels } =
    useSettingsStore()
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen)

  const selectedModel = models.find((model) => model.id === settings.model)

  const handleModelChange = async (model: string): Promise<void> => {
    const newSettings = { ...settings, model }
    setSettings(newSettings)
    await window.api.settings.save(newSettings)
  }

  const handleVendorChange = async (modelProvider: string): Promise<void> => {
    const newSettings = { ...settings, modelProvider }
    setSettings(newSettings)
    await window.api.settings.save(newSettings)
  }

  return (
    <div className="drag-region flex min-h-11 shrink-0 items-center gap-2 border-b border-white/5 bg-background/90 px-3 py-1.5 backdrop-blur-xl">
      <div className="flex shrink-0 items-center gap-2.5 no-drag">
        <AppLogo size="sm" />
        <span className="hidden text-sm font-semibold gradient-text xl:inline">{t('appName')}</span>
      </div>

      <div className="no-drag min-w-[8rem] flex-1">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="mx-auto flex h-7 w-full max-w-md items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-left transition-colors hover:border-white/15 hover:bg-white/[0.05]"
          title={t('commandPalette.openTooltip')}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">
            {t('commandPalette.triggerPlaceholder')}
          </span>
          <kbd className="hidden rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 sm:inline">
            Ctrl+P
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 py-0.5 no-drag">
        <ModelPicker
          compact
          value={settings.model}
          models={models}
          loading={modelsLoading}
          onChange={handleModelChange}
          onRefresh={loadModels}
        />
        <ModelVendorSelect
          modelId={settings.model}
          value={settings.modelProvider ?? ''}
          catalogPriceLabel={selectedModel?.priceLabel}
          onChange={(tag) => void handleVendorChange(tag)}
        />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-400 hover:text-zinc-200"
          onClick={() => setSettingsOpen(true)}
          title={t('titleBar.settings')}
          aria-label={t('titleBar.settings')}
        >
          <Settings className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => window.api.window.minimize()}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => window.api.window.maximize()}
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-red-500/20 hover:text-red-400"
          onClick={() => window.api.window.close()}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
