import { describe, expect, it } from 'vitest'
import { settingsSaveEffects } from './settings-save'

const saved = {
  apiKey: 'sk-test',
  model: 'openai/gpt-4.1',
  searchApiKey: '',
  searchProvider: 'tavily' as const,
  indexOnOpen: true,
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  maxFileSizeKb: 1024,
  semanticSearchEnabled: false
}

describe('saving settings', () => {
  it('does not reconnect MCP or refresh anything when the saved fields are unchanged', () => {
    const effects = settingsSaveEffects(saved, saved)
    expect(Object.keys(effects).sort()).toEqual([
      'refreshIndex',
      'refreshModelClient',
      'refreshSearch'
    ])
    expect(effects).toEqual({
      refreshModelClient: false,
      refreshSearch: false,
      refreshIndex: false
    })
  })

  it('refreshes the model client only when the key or model changed', () => {
    expect(settingsSaveEffects(saved, { ...saved, apiKey: 'sk-new' })).toEqual({
      refreshModelClient: true,
      refreshSearch: false,
      refreshIndex: false
    })
    expect(settingsSaveEffects(saved, { ...saved, model: 'anthropic/claude' }).refreshModelClient).toBe(
      true
    )
  })

  it('refreshes search only when the search provider or key changed', () => {
    expect(settingsSaveEffects(saved, { ...saved, searchProvider: 'brave' })).toEqual({
      refreshModelClient: false,
      refreshSearch: true,
      refreshIndex: false
    })
    expect(settingsSaveEffects(saved, { ...saved, searchApiKey: 'tvly' })).toEqual({
      refreshModelClient: false,
      refreshSearch: true,
      refreshIndex: false
    })
  })

  it('rebuilds the index when any index setting changed', () => {
    for (const next of [
      { ...saved, semanticSearchEnabled: true },
      { ...saved, indexOnOpen: false },
      { ...saved, embeddingModel: 'other-model' },
      { ...saved, maxFileSizeKb: 2048 }
    ]) {
      expect(settingsSaveEffects(saved, next)).toEqual({
        refreshModelClient: false,
        refreshSearch: false,
        refreshIndex: true
      })
    }
  })
})
