export type IndexState = 'idle' | 'building' | 'ready' | 'error'

export type IndexPhase =
  | 'scanning'
  | 'indexing_text'
  | 'indexing_symbols'
  | 'embedding'
  | 'vectors'
  | 'done'

export interface IndexProgress {
  phase: IndexPhase
  filesDone: number
  filesTotal: number
  message?: string
}

export interface IndexStatus {
  state: IndexState
  workspacePath: string | null
  filesIndexed: number
  chunks: number
  symbols: number
  lastBuiltAt: string | null
  progress: IndexProgress | null
  error: string | null
  semanticReady: boolean
  symbolReady: boolean
}

export type CodebaseSearchMode = 'hybrid' | 'text' | 'semantic' | 'symbol'

export interface CodebaseSearchRequest {
  query: string
  mode: CodebaseSearchMode
  root?: string
  limit?: number
  pathGlob?: string
}

export interface CodebaseSearchHit {
  path: string
  startLine: number
  endLine: number
  score: number
  channel: 'text' | 'semantic' | 'symbol'
  snippet: string
  symbolName?: string
  symbolKind?: string
}

export interface ManifestEntry {
  path: string
  absolutePath: string
  hash: string
  mtimeMs: number
  size: number
  language: string
}

export interface IndexSettings {
  indexOnOpen: boolean
  embeddingModel: string
  maxFileSizeKb: number
  semanticSearchEnabled: boolean
}

export const DEFAULT_INDEX_SETTINGS: IndexSettings = {
  indexOnOpen: true,
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  maxFileSizeKb: 1024,
  semanticSearchEnabled: true
}

export const INDEX_VERSION = 1
