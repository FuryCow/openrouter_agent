import { readFile, writeFile, readdir, stat, mkdir, rm, rename } from 'fs/promises'
import { join, dirname } from 'path'
import type { DirEntry, SearchResult } from '../types'
import type { CodebaseIndexer } from './indexing/codebase-indexer'
import { ripgrepSearch } from './indexing/ripgrep-search'

export class FileSystemService {
  constructor(private indexer: CodebaseIndexer | null = null) {}

  setIndexer(indexer: CodebaseIndexer): void {
    this.indexer = indexer
  }
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
    if (this.indexer) {
      return this.indexer.searchFiles(query, root)
    }
    return ripgrepSearch(query, root, 100)
  }

  async grepWorkspace(
    query: string,
    root: string,
    options?: { limit?: number; pathGlob?: string }
  ): Promise<SearchResult[]> {
    return ripgrepSearch(query, root, {
      limit: options?.limit ?? 100,
      pathGlob: options?.pathGlob
    })
  }

  async readFiles(
    filePaths: string[]
  ): Promise<Array<{ path: string; content?: string; error?: string }>> {
    const results: Array<{ path: string; content?: string; error?: string }> = []

    for (const filePath of filePaths) {
      try {
        const content = await readFile(filePath, 'utf-8')
        results.push({ path: filePath, content })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read file'
        results.push({ path: filePath, error: message })
      }
    }

    return results
  }
}
