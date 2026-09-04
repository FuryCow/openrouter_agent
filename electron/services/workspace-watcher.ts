import { watch, type FSWatcher } from 'fs'

export class WorkspaceWatcher {
  private watcher: FSWatcher | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(dir: string, onChange: () => void): void {
    this.stop()
    if (!dir) return

    const emit = (): void => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(onChange, 200)
    }

    try {
      this.watcher = watch(dir, { recursive: true }, emit)
    } catch {
      this.watcher = watch(dir, emit)
    }
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }
}
