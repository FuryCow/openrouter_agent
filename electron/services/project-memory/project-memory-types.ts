export type ProjectMemoryCategory =
  | 'architecture'
  | 'decision'
  | 'bug'
  | 'convention'
  | 'note'

export type ProjectMemorySource = 'agent' | 'user' | 'remember'

export interface ProjectMemoryEntry {
  id: string
  category: ProjectMemoryCategory
  content: string
  source: ProjectMemorySource
  createdAt: string
}

export interface ProjectMemoryFile {
  version: 1
  entries: ProjectMemoryEntry[]
}

export interface ProjectMemorySnapshotOptions {
  includeDocs?: boolean
  includeCursorRules?: boolean
  tokenBudget?: number
}

export interface RememberMemoryInput {
  content: string
  category?: ProjectMemoryCategory
  source?: ProjectMemorySource
}

export interface UpdateProjectMemoryInput {
  action: 'append' | 'update' | 'delete'
  content?: string
  id?: string
  category?: ProjectMemoryCategory
  source?: ProjectMemorySource
}

export interface ReadProjectMemoryInput {
  category?: ProjectMemoryCategory
  query?: string
}

export const PROJECT_MEMORY_CATEGORIES: ProjectMemoryCategory[] = [
  'architecture',
  'decision',
  'bug',
  'convention',
  'note'
]

export const DEFAULT_SNAPSHOT_TOKEN_BUDGET = 6000
export const MAX_DOC_BYTES = 8192
