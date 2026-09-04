import type { AppSettings } from '../types'

export const MAX_RECENT_WORKSPACES = 8

export function withRecentWorkspace(settings: AppSettings, workspacePath: string): AppSettings {
  const recent = [
    workspacePath,
    ...(settings.recentWorkspaces ?? []).filter((p) => p !== workspacePath)
  ].slice(0, MAX_RECENT_WORKSPACES)

  return {
    ...settings,
    workingDirectory: workspacePath,
    recentWorkspaces: recent
  }
}
