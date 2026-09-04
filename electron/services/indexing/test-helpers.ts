import { openSqliteDatabase } from './native-sqlite'

export function sqliteAvailableForTests(): boolean {
  if (process.versions.electron) return true
  try {
    const db = openSqliteDatabase(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
}
