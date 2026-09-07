import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import type { FileSystemService } from './filesystem'

type SnapshotEntry = { kind: 'existing'; content: string } | { kind: 'new' }

export interface RunCheckpointSummary {
  paths: string[]
  count: number
}

export class RunCheckpoint {
  private snapshots = new Map<string, SnapshotEntry>()

  get summary(): RunCheckpointSummary {
    const paths = [...this.snapshots.keys()]
    return { paths, count: paths.length }
  }

  hasChanges(): boolean {
    return this.snapshots.size > 0
  }

  async captureBeforeMutation(fs: FileSystemService, filePath: string): Promise<void> {
    if (this.snapshots.has(filePath)) return

    if (existsSync(filePath)) {
      const content = await fs.readFile(filePath)
      this.snapshots.set(filePath, { kind: 'existing', content })
    } else {
      this.snapshots.set(filePath, { kind: 'new' })
    }
  }

  async restore(fs: FileSystemService): Promise<{ restored: number; deleted: number }> {
    let restored = 0
    let deleted = 0

    for (const [path, entry] of this.snapshots) {
      if (entry.kind === 'new') {
        if (existsSync(path)) {
          await unlink(path)
          deleted++
        }
      } else {
        await fs.writeFile(path, entry.content)
        restored++
      }
    }

    this.snapshots.clear()
    return { restored, deleted }
  }

  clear(): void {
    this.snapshots.clear()
  }
}
