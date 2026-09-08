import { create } from 'zustand'
import type { AppSettings, ModelInfo } from '../types'
import { useFileStore } from './fileStore'
import { isStaleModelCatalog } from '../lib/models'
import type { SettingsSection } from '../lib/settingsSections'
import { setAppLocale } from '../i18n'
import { getT } from '../i18n/t'

interface SettingsState {
  settings: AppSettings
  hydrated: boolean
  models: ModelInfo[]
  modelsLoading: boolean
  modelsError: string | null
  settingsOpen: boolean
  settingsFocusSection: SettingsSection | null
  terminalOpen: boolean
  setSettings: (settings: AppSettings) => void
  setModels: (models: ModelInfo[]) => void
  setSettingsOpen: (open: boolean, focusSection?: SettingsSection) => void
  setTerminalOpen: (open: boolean) => void
  loadSettings: () => Promise<void>
  loadModels: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    apiKey: '',
    model: 'anthropic/claude-sonnet-4',
    workingDirectory: '',
    locale: 'en'
  },
  hydrated: false,
  models: [],
  modelsLoading: false,
  modelsError: null,
  settingsOpen: false,
  settingsFocusSection: null,
  terminalOpen: true,

  setSettings: (settings) => set({ settings }),
  setModels: (models) => set({ models }),
  setSettingsOpen: (open, focusSection = 'general') =>
    set({ settingsOpen: open, settingsFocusSection: open ? focusSection : null }),
  setTerminalOpen: (open) => set({ terminalOpen: open }),

  loadModels: async () => {
    const t = getT('settings')
    set({ modelsLoading: true, modelsError: null })
    try {
      const models = await window.api.models.list()
      const { settings } = get()

      if (models.length === 0) {
        set({
          models: [],
          modelsLoading: false,
          modelsError: t('models.loadFailed')
        })
        return
      }

      if (isStaleModelCatalog(models)) {
        set({
          models,
          modelsLoading: false,
          modelsError: t('models.staleCatalog')
        })
        return
      }

      const hasSelected = models.some((m) => m.id === settings.model)
      if (!hasSelected) {
        const nextSettings = { ...settings, model: models[0].id }
        await window.api.settings.save(nextSettings)
        set({ settings: nextSettings, models, modelsLoading: false, modelsError: null })
        return
      }

      set({ models, modelsLoading: false, modelsError: null })
    } catch (err) {
      set({
        modelsLoading: false,
        modelsError: err instanceof Error ? err.message : t('models.failed')
      })
    }
  },

  loadSettings: async () => {
    try {
      const settings = await window.api.settings.get()
      await setAppLocale(settings.locale ?? 'en')
      set({ settings, hydrated: true })
      useFileStore.getState().setWorkingDirectory(settings.workingDirectory || null)
      await get().loadModels()
    } catch {
      set({ hydrated: true })
    }
  }
}))
