import type { AppSettings } from '../types'

export async function saveAppSettings(input: {
  draft: AppSettings
  save: (settings: AppSettings) => Promise<void>
  applyLocal: (settings: AppSettings) => void
  reloadModels: () => Promise<void>
  close: () => void
}): Promise<void> {
  await input.save(input.draft)
  input.applyLocal(input.draft)
  await input.reloadModels()
  input.close()
}
