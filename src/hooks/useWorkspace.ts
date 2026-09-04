import { useCallback } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'

export function useWorkspace(): {
  workingDirectory: string | null
  recentWorkspaces: string[]
  openFolderPicker: () => Promise<void>
  openWorkspace: (path: string) => Promise<void>
} {
  const workingDirectory = useFileStore((s) => s.workingDirectory)
  const setWorkingDirectory = useFileStore((s) => s.setWorkingDirectory)
  const settings = useSettingsStore((s) => s.settings)
  const setSettings = useSettingsStore((s) => s.setSettings)
  const addToast = useToastStore((s) => s.addToast)

  const syncFromSaved = useCallback(async (path: string) => {
    setWorkingDirectory(path)
    const saved = await window.api.settings.get()
    setSettings(saved)
  }, [setSettings, setWorkingDirectory])

  const openWorkspace = useCallback(
    async (path: string): Promise<void> => {
      try {
        const applied = await window.api.fs.setWorkspace(path)
        await syncFromSaved(applied)
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Не удалось открыть папку', 'error')
      }
    },
    [addToast, syncFromSaved]
  )

  const openFolderPicker = useCallback(async (): Promise<void> => {
    try {
      const path = await window.api.fs.openFolder()
      if (path) await syncFromSaved(path)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Эту папку нельзя использовать как проект', 'error')
    }
  }, [addToast, syncFromSaved])

  const recentWorkspaces = (settings.recentWorkspaces ?? []).filter(
    (path) => path && path !== workingDirectory
  )

  return {
    workingDirectory,
    recentWorkspaces,
    openFolderPicker,
    openWorkspace
  }
}
