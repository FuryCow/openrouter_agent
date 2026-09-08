import { Minus, Square, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { ModelPicker } from '../models/ModelPicker'
import { AppLogo } from '../brand/AppLogo'
import { useSettingsStore } from '@/stores/settingsStore'
export function TitleBar(): React.ReactElement {
  const { t } = useTranslation('layout')
  const { settings, models, modelsLoading, setSettings, setSettingsOpen, loadModels } =
    useSettingsStore()

  const handleModelChange = async (model: string): Promise<void> => {
    const newSettings = { ...settings, model }
    setSettings(newSettings)
    await window.api.settings.save(newSettings)
  }

  return (
    <div className="drag-region chrome-header justify-between bg-background/90 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 no-drag">
        <AppLogo size="sm" />
        <span className="text-sm font-semibold gradient-text">{t('appName')}</span>
      </div>
      <div className="flex items-center gap-2 no-drag">
        <ModelPicker
          compact
          value={settings.model}
          models={models}
          loading={modelsLoading}
          onChange={handleModelChange}
          onRefresh={loadModels}
        />

        <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
          {t('titleBar.settings')}
        </Button>
      </div>

      <div className="flex items-center gap-1 no-drag">
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
