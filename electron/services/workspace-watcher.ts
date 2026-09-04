import { watch, type FSWatcher } from 'fs'
import { join, relative } from 'path'

export class WorkspaceWatcher {
  private watcher: FSWatcher | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private changedPaths = new Set<string>()
  private workspaceRoot = ''

  watch(dir: string, onChange: (changedPaths: string[]) => void): void {
    this.stop()
    if (!dir) return
    this.workspaceRoot = dir

    const emit = (): void => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        const paths = [...this.changedPaths]
        this.changedPaths.clear()
        if (paths.length > 0) onChange(paths)
      }, 300)
    }

    const record = (fileName: string | Buffer | null): void => {
      if (!fileName) {
        this.changedPaths.add('.')
        emit()
        return
      }
      const name = fileName.toString()
      const absolutePath = name.includes(':') || name.startsWith('/') || name.startsWith('\\')
        ? name
        : join(dir, name)
      const rel = relative(this.workspaceRoot, absolutePath).replace(/\\/g, '/')
      if (!rel || rel.startsWith('..')) return
      this.changedPaths.add(rel)
      emit()
    }

    try {
      this.watcher = watch(dir, { recursive: true }, (_eventType, fileName) => {
        record(fileName)
      })
    } catch {
      this.watcher = watch(dir, (_eventType, fileName) => {
        record(fileName)
      })
    }
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
    this.changedPaths.clear()
    this.workspaceRoot = ''
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }
}
