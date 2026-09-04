import type DatabaseType from 'better-sqlite3'
import type { ManifestEntry } from './index-types'
import { INDEX_VERSION } from './index-types'
import { openSqliteDatabase } from './native-sqlite'

export interface FtsHit {
  path: string
  startLine: number
  endLine: number
  snippet: string
  rank: number
}

export interface SymbolRow {
  path: string
  name: string
  kind: string
  startLine: number
  endLine: number
  content: string
}

export interface ChunkRow {
  id: number
  path: string
  startLine: number
  endLine: number
  content: string
  symbolName: string | null
}

export class IndexStore {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = openSqliteDatabase(dbPath)
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS index_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS file_manifest (
        path TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        mtime_ms INTEGER NOT NULL,
        size INTEGER NOT NULL,
        language TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
        path UNINDEXED,
        start_line UNINDEXED,
        end_line UNINDEXED,
        content,
        tokenize = 'porter'
      );

      CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        content TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_symbols_path ON symbols(path);
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);

      CREATE TABLE IF NOT EXISTS chunk_meta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        content TEXT NOT NULL,
        symbol_name TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_chunk_meta_path ON chunk_meta(path);
    `)

    const version = this.getMeta('version')
    if (!version) {
      this.setMeta('version', String(INDEX_VERSION))
    } else if (Number(version) !== INDEX_VERSION) {
      this.resetAll()
      this.setMeta('version', String(INDEX_VERSION))
    }
  }

  close(): void {
    this.db.close()
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM index_meta WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO index_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  }

  resetAll(): void {
    this.db.exec(`
      DELETE FROM fts_chunks;
      DELETE FROM symbols;
      DELETE FROM chunk_meta;
      DELETE FROM file_manifest;
    `)
  }

  upsertManifest(entries: ManifestEntry[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO file_manifest (path, hash, mtime_ms, size, language)
      VALUES (@path, @hash, @mtimeMs, @size, @language)
      ON CONFLICT(path) DO UPDATE SET
        hash = excluded.hash,
        mtime_ms = excluded.mtime_ms,
        size = excluded.size,
        language = excluded.language
    `)
    const tx = this.db.transaction((rows: ManifestEntry[]) => {
      for (const row of rows) stmt.run(row)
    })
    tx(entries)
  }

  removeManifestPaths(paths: string[]): void {
    if (paths.length === 0) return
    const stmt = this.db.prepare('DELETE FROM file_manifest WHERE path = ?')
    const tx = this.db.transaction((items: string[]) => {
      for (const path of items) stmt.run(path)
    })
    tx(paths)
  }

  listManifest(): ManifestEntry[] {
    return this.db
      .prepare('SELECT path, hash, mtime_ms as mtimeMs, size, language FROM file_manifest')
      .all() as ManifestEntry[]
  }

  purgeFile(path: string): void {
    this.db.prepare('DELETE FROM file_manifest WHERE path = ?').run(path)
    this.db.prepare('DELETE FROM fts_chunks WHERE path = ?').run(path)
    this.db.prepare('DELETE FROM symbols WHERE path = ?').run(path)
    this.db.prepare('DELETE FROM chunk_meta WHERE path = ?').run(path)
  }

  replaceFileFts(path: string, chunks: Array<{ startLine: number; endLine: number; content: string }>): void {
    this.db.prepare('DELETE FROM fts_chunks WHERE path = ?').run(path)
    const stmt = this.db.prepare(
      'INSERT INTO fts_chunks (path, start_line, end_line, content) VALUES (?, ?, ?, ?)'
    )
    const tx = this.db.transaction((rows: Array<{ startLine: number; endLine: number; content: string }>) => {
      for (const row of rows) stmt.run(path, row.startLine, row.endLine, row.content)
    })
    tx(chunks)
  }

  replaceFileSymbols(path: string, symbols: SymbolRow[]): void {
    this.db.prepare('DELETE FROM symbols WHERE path = ?').run(path)
    const stmt = this.db.prepare(
      'INSERT INTO symbols (path, name, kind, start_line, end_line, content) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const tx = this.db.transaction((rows: SymbolRow[]) => {
      for (const row of rows) stmt.run(row.path, row.name, row.kind, row.startLine, row.endLine, row.content)
    })
    tx(symbols)
  }

  replaceFileChunks(path: string, chunks: ChunkRow[]): Omit<ChunkRow, 'path'>[] {
    this.db.prepare('DELETE FROM chunk_meta WHERE path = ?').run(path)
    const stmt = this.db.prepare(
      'INSERT INTO chunk_meta (path, start_line, end_line, content, symbol_name) VALUES (?, ?, ?, ?, ?)'
    )
    const inserted: ChunkRow[] = []
    const tx = this.db.transaction((rows: ChunkRow[]) => {
      for (const row of rows) {
        const result = stmt.run(path, row.startLine, row.endLine, row.content, row.symbolName)
        inserted.push({
          id: Number(result.lastInsertRowid),
          path,
          startLine: row.startLine,
          endLine: row.endLine,
          content: row.content,
          symbolName: row.symbolName
        })
      }
    })
    tx(chunks)
    return inserted
  }

  searchFts(query: string, limit = 20): FtsHit[] {
    const safeQuery = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => `"${token.replace(/"/g, '')}"`)
      .join(' OR ')
    if (!safeQuery) return []

    try {
      const rows = this.db
        .prepare(
          `SELECT path, start_line, end_line, snippet(fts_chunks, 3, '[', ']', '…', 10) as snippet,
                  bm25(fts_chunks) as rank
           FROM fts_chunks
           WHERE fts_chunks MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(safeQuery, limit) as Array<{
        path: string
        start_line: number
        end_line: number
        snippet: string
        rank: number
      }>

      return rows.map((row) => ({
        path: row.path,
        startLine: row.start_line,
        endLine: row.end_line,
        snippet: row.snippet,
        rank: row.rank
      }))
    } catch {
      return []
    }
  }

  searchSymbols(query: string, limit = 20): SymbolRow[] {
    const like = `%${query}%`
    return this.db
      .prepare(
        `SELECT path, name, kind, start_line as startLine, end_line as endLine, content
         FROM symbols
         WHERE name LIKE ? OR content LIKE ?
         LIMIT ?`
      )
      .all(like, like, limit) as SymbolRow[]
  }

  getAllChunks(): ChunkRow[] {
    return this.db
      .prepare(
        `SELECT id, path, start_line as startLine, end_line as endLine, content, symbol_name as symbolName
         FROM chunk_meta`
      )
      .all() as ChunkRow[]
  }

  countFiles(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM file_manifest').get() as { count: number }
    return row.count
  }

  countChunks(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM chunk_meta').get() as { count: number }
    return row.count
  }

  countSymbols(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM symbols').get() as { count: number }
    return row.count
  }
}
