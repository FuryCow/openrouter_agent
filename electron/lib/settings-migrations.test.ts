import { describe, expect, it } from 'vitest'
import { CURRENT_SETTINGS_VERSION, migrateSettings } from './settings-migrations'

describe('settings-migrations', () => {
  it('migrates a legacy alpha.15 settings object: strips removed fields, defaults locale, stamps version', () => {
    const legacy = {
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-sonnet-4',
      workingDirectory: 'C:\\repo',
      modelsByMode: { agent: 'old/model' },
      maxTokens: 4096,
      temperature: 0.7,
      autoApproveWrites: true
    }
    const migrated = migrateSettings(legacy)

    expect(migrated.apiKey).toBe('sk-or-test')
    expect(migrated.model).toBe('anthropic/claude-sonnet-4')
    expect(migrated.workingDirectory).toBe('C:\\repo')
    expect(migrated.temperature).toBe(0.7)
    expect(migrated.autoApproveWrites).toBe(true)
    expect(migrated.locale).toBe('en')
    expect(migrated).not.toHaveProperty('modelsByMode')
    expect(migrated).not.toHaveProperty('maxTokens')
    expect(migrated.settingsVersion).toBe(CURRENT_SETTINGS_VERSION)
  })

  it('migrates an empty/corrupt store to a usable default shape', () => {
    for (const raw of [null, undefined, 'garbage', 42, []]) {
      const migrated = migrateSettings(raw)
      expect(migrated.locale).toBe('en')
      expect(migrated.settingsVersion).toBe(CURRENT_SETTINGS_VERSION)
      expect(migrated.apiKey).toBe('')
    }
  })

  it('is idempotent: migrating a current-version object preserves user values', () => {
    const current = {
      apiKey: 'key',
      model: 'm',
      workingDirectory: '/repo',
      locale: 'en' as const,
      recentWorkspaces: ['/repo', '/other'],
      mcpServers: [{ id: 's1', enabled: true, transport: 'stdio' as const }],
      settingsVersion: CURRENT_SETTINGS_VERSION
    }
    const migrated = migrateSettings(current)
    expect(migrated).toEqual(current)
  })

  it('drops non-array collection fields instead of crashing downstream consumers', () => {
    const broken = {
      apiKey: '',
      model: 'm',
      recentWorkspaces: 'not-an-array',
      mcpServers: { oops: true },
      mcpImportPaths: 5,
      settingsVersion: 1
    }
    const migrated = migrateSettings(broken)
    expect(migrated).not.toHaveProperty('recentWorkspaces')
    expect(migrated).not.toHaveProperty('mcpServers')
    expect(migrated).not.toHaveProperty('mcpImportPaths')
    expect(migrated.settingsVersion).toBe(CURRENT_SETTINGS_VERSION)
  })

  it('upgrade path alpha.15 → 1.0.0: flags stay strictly opt-in (undefined, not coerced)', () => {
    const legacy = {
      apiKey: 'k',
      model: 'm',
      workingDirectory: '/repo'
      // no skillsEnabled / runQueueEnabled — legacy users never had them
    }
    const migrated = migrateSettings(legacy)
    expect(migrated.skillsEnabled).toBeUndefined()
    expect(migrated.runQueueEnabled).toBeUndefined()
    expect(migrated.settingsVersion).toBe(CURRENT_SETTINGS_VERSION)
  })
})
