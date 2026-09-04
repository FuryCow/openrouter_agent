import { readFile, writeFile, readdir, stat, mkdir, rm, rename } from 'fs/promises'
import { join, relative, dirname } from 'path'
import type { DirEntry, SearchResult } from '../types'

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'release', '.next', 'build'])

export class FileSystemService {
  async readFile(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8')
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content, 'utf-8')
  }

  async searchReplace(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll = false
  ): Promise<{ replacements: number }> {
    if (!oldString) {
      throw new Error('old_string cannot be empty')
    }
    if (oldString === newString) {
      throw new Error('old_string and new_string are identical')
    }

    const content = await readFile(filePath, 'utf-8')
    const occurrences = content.split(oldString).length - 1

    if (occurrences === 0) {
      throw new Error('old_string not found in file. Read the file first and copy the exact text to replace.')
    }
    if (occurrences > 1 && !replaceAll) {
      throw new Error(
        `old_string matched ${occurrences} times. Include more surrounding context for a unique match, or set replace_all to true.`
      )
    }

    const updated = replaceAll
      ? content.split(oldString).join(newString)
      : content.replace(oldString, newString)

    await writeFile(filePath, updated, 'utf-8')
    return { replacements: replaceAll ? occurrences : 1 }
  }

  async createFile(parentDir: string, name: string): Promise<string> {
    const filePath = join(parentDir, name)
    await writeFile(filePath, '', 'utf-8')
    return filePath
  }

  async createDirectory(parentDir: string, name: string): Promise<string> {
    const dirPath = join(parentDir, name)
    await mkdir(dirPath)
    return dirPath
  }

  async renamePath(targetPath: string, newName: string): Promise<string> {
    const newPath = join(dirname(targetPath), newName)
    await rename(targetPath, newPath)
    return newPath
  }

  async deletePath(targetPath: string): Promise<void> {
    await rm(targetPath, { recursive: true, force: true })
  }

  async isDirectory(targetPath: string): Promise<boolean> {
    const info = await stat(targetPath)
    return info.isDirectory()
  }

  async listDir(dirPath: string): Promise<DirEntry[]> {
    const entries = await readdir(dirPath)
    const result: DirEntry[] = []

    for (const name of entries) {
      if (name.startsWith('.')) continue
      const fullPath = join(dirPath, name)
      try {
        const info = await stat(fullPath)
        result.push({
          name,
          path: fullPath,
          isDirectory: info.isDirectory()
        })
      } catch {
        // skip inaccessible entries
      }
    }

    return result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  async searchFiles(query: string, root: string): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    const regex = new RegExp(query, 'i')
    await this.walkDir(root, async (filePath) => {
      try {
        const content = await readFile(filePath, 'utf-8')
        const lines = content.split('\n')
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            results.push({
              file: relative(root, filePath),
              line: index + 1,
              content: line.trim().slice(0, 200)
            })
          }
        })
      } catch {
        // skip binary or unreadable files
      }
    })
    return results.slice(0, 100)
  }

  private async walkDir(dir: string, onFile: (path: string) => Promise<void>): Promise<void> {
    let entries
    try {
      entries = await readdir(dir)
    } catch {
      return
    }

    for (const name of entries) {
      if (name.startsWith('.') || IGNORED_DIRS.has(name)) continue
      const fullPath = join(dir, name)
      try {
        const info = await stat(fullPath)
        if (info.isDirectory()) {
          await this.walkDir(fullPath, onFile)
        } else if (info.isFile() && info.size < 1024 * 1024) {
          await onFile(fullPath)
        }
      } catch {
        // skip
      }
    }
  }
}
