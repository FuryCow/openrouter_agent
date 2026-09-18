import type { AppSettings } from '@/types'

export function applyHydratedSettings(
  settings: AppSettings,
  setWorkingDirectory: (path: string | null) => void
): AppSettings {
  setWorkingDirectory(settings.workingDirectory || null)
  return settings
}
