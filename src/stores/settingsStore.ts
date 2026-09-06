import { create } from 'zustand'
import type { AppSettings, ModelInfo } from '../types'
import { useFileStore } from './fileStore'
import { isStaleModelCatalog } from '../lib/models'

interface SettingsState {
  settings: AppSettings
  models: ModelInfo[]
  modelsLoading: boolean
  modelsError: string | null
  settingsOpen: boolean
  settingsFocusSection: 'general' | 'mcp' | null
  terminalOpen: boolean
  setSettings: (settings: AppSettings) => void
  setModels: (models: ModelInfo[]) => void
  setSettingsOpen: (open: boolean, focusSection?: 'general' | 'mcp') => void
  setTerminalOpen: (open: boolean) => void
  loadSettings: () => Promise<void>
  loadModels: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    apiKey: '',
    model: 'anthropic/claude-sonnet-4',
    workingDirectory: ''
  },
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
    set({ modelsLoading: true, modelsError: null })
    try {
      const models = await window.api.models.list()
      const { settings } = get()

      if (models.length === 0) {
        set({
          models: [],
          modelsLoading: false,
          modelsError: 'Could not load models from OpenRouter. Check your connection and try Refresh.'
        })
        return
      }

      if (isStaleModelCatalog(models)) {
        set({
          models,
          modelsLoading: false,
          modelsError:
            'Loaded outdated model list (50 without prices). Close the app completely and run start.bat again.'
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
        modelsError: err instanceof Error ? err.message : 'Failed to load models'
      })
    }
  },

  loadSettings: async () => {
    const settings = await window.api.settings.get()
    set({ settings })
    useFileStore.getState().setWorkingDirectory(settings.workingDirectory || null)
    await get().loadModels()
  }
}))
