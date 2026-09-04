import type DatabaseType from 'better-sqlite3'

export function openSqliteDatabase(dbPath: string): DatabaseType.Database {
  // Lazy require so Electron main can start before native module loads.
  const Database = require('better-sqlite3') as typeof DatabaseType
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  return db
}
