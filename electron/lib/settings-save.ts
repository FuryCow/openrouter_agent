import type { AppSettings } from '../types'

export interface SettingsSaveEffects {
  refreshModelClient: boolean
  refreshSearch: boolean
  refreshIndex: boolean
}

type SettingsSaveSlice = Pick<
  AppSettings,
  | 'apiKey'
  | 'model'
  | 'searchApiKey'
  | 'searchProvider'
  | 'indexOnOpen'
  | 'embeddingModel'
  | 'maxFileSizeKb'
  | 'semanticSearchEnabled'
>

/** What a settings save is allowed to refresh. MCP reconnect is not one of them. */
export function settingsSaveEffects(
  previous: SettingsSaveSlice,
  next: SettingsSaveSlice
): SettingsSaveEffects {
  return {
    refreshModelClient: previous.apiKey !== next.apiKey || previous.model !== next.model,
    refreshSearch:
      previous.searchApiKey !== next.searchApiKey || previous.searchProvider !== next.searchProvider,
    refreshIndex:
      previous.indexOnOpen !== next.indexOnOpen ||
      previous.embeddingModel !== next.embeddingModel ||
      previous.maxFileSizeKb !== next.maxFileSizeKb ||
      previous.semanticSearchEnabled !== next.semanticSearchEnabled
  }
}
