import type { AppSettings } from '../types'

/**
 * Settings schema versioning.
 *
 * v1 = legacy shape shipped through v1.0.0-alpha.15 (no version field,
 *      may contain removed fields `modelsByMode` / `maxTokens`).
 * v2 = current shape: legacy fields stripped, collection fields normalized
 *      to arrays, `settingsVersion` stamped.
 *
 * Add future migrations as `toV3`, `toV4`, … and bump CURRENT_SETTINGS_VERSION.
 * Every migration must be idempotent and must never drop user data.
 */
export const CURRENT_SETTINGS_VERSION = 2

type LegacySettings = AppSettings & {
  modelsByMode?: Partial<Record<string, string>>
  maxTokens?: number
  settingsVersion?: number
}

/** v0/legacy → v1: strip removed fields, default the locale and required scalars. */
function toV1(raw: LegacySettings): AppSettings {
  const { modelsByMode: _modes, maxTokens: _tokens, ...clean } = raw
  const settings = clean as AppSettings
  if (typeof settings.apiKey !== 'string') settings.apiKey = ''
  if (typeof settings.model !== 'string' || !settings.model) {
    settings.model = 'anthropic/claude-sonnet-4'
  }
  if (typeof settings.workingDirectory !== 'string') settings.workingDirectory = ''
  if (!settings.locale) settings.locale = 'en'
  return settings
}

/** v1 → v2: normalize collection fields to arrays, default the run queue on, stamp the version. */
function toV2(settings: AppSettings): AppSettings {
  const next: AppSettings = { ...settings }
  if (next.recentWorkspaces !== undefined && !Array.isArray(next.recentWorkspaces)) {
    delete next.recentWorkspaces
  }
  if (next.mcpServers !== undefined && !Array.isArray(next.mcpServers)) {
    delete next.mcpServers
  }
  if (next.mcpImportPaths !== undefined && !Array.isArray(next.mcpImportPaths)) {
    delete next.mcpImportPaths
  }
  // Run queue is stable as of 1.0.0 — enable it for users who never set the flag.
  // An explicit `false` (user turned it off) is preserved.
  if (next.runQueueEnabled === undefined) next.runQueueEnabled = true
  next.settingsVersion = CURRENT_SETTINGS_VERSION
  return next
}

/**
 * Migrate a raw settings object from the store to the current shape.
 * Accepts unknown input (corrupt/partial stores) and always returns a
 * usable AppSettings. Idempotent: migrating an already-current object
 * returns an equivalent shape without touching user values.
 */
export function migrateSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return toV2(toV1({} as LegacySettings))
  }
  let settings = raw as LegacySettings
  const version = typeof settings.settingsVersion === 'number' ? settings.settingsVersion : 0
  if (version < 1) settings = toV1(settings) as LegacySettings
  if (version < 2) settings = toV2(settings as AppSettings) as LegacySettings
  return settings as AppSettings
}
