/** undefined = not ready yet; null = no workspace; string = resolved path */
export function resolveWorkspacePath(
  hydrated: boolean,
  workingDirectory: string | null,
  settingsWorkingDirectory?: string | null
): string | null | undefined {
  if (!hydrated) return undefined
  const settingsWorkspace = settingsWorkingDirectory?.trim() || null
  if (workingDirectory === null && settingsWorkspace !== null) return undefined
  return workingDirectory ?? settingsWorkspace
}
