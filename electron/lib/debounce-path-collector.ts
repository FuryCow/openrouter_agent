export function requeueIfBusy(
  busy: boolean,
  paths: string[],
  requeue: (path: string) => void
): boolean {
  if (!busy) return false
  for (const path of paths) requeue(path)
  return true
}

export function createDebouncedPathCollector(
  debounceMs: number,
  onFlush: (paths: string[]) => void
): {
  add: (path: string) => void
  cancel: () => void
} {
  const changedPaths = new Set<string>()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const flush = (): void => {
    debounceTimer = null
    const paths = [...changedPaths]
    changedPaths.clear()
    if (paths.length > 0) onFlush(paths)
  }

  return {
    add(path: string) {
      changedPaths.add(path)
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(flush, debounceMs)
    },
    cancel() {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = null
      changedPaths.clear()
    }
  }
}
