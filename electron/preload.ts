import { contextBridge, ipcRenderer } from 'electron'
import type {
  AgentContext,
  AgentEvent,
  AgentRunAnalytics,
  AppSettings,
  DirEntry,
  ModelInfo,
  SearchResult,
  IndexStatus,
  IndexProgress,
  CodebaseSearchRequest,
  CodebaseSearchHit,
  McpServerConfig,
  McpStatusSnapshot,
  ProjectMemoryEntry,
  ProjectMemoryCategory
} from './types'

export interface ElectronAPI {
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
  settings: {
    get: () => Promise<AppSettings>
    save: (settings: AppSettings) => Promise<AppSettings>
  }
  models: {
    list: () => Promise<ModelInfo[]>
  }
  fs: {
    openFolder: () => Promise<string | null>
    setWorkspace: (path: string) => Promise<string>
    listWorkspaceFiles: () => Promise<string[]>
    readFile: (path: string) => Promise<string>
    readFileDataUrl: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    listDir: (path: string) => Promise<DirEntry[]>
    searchFiles: (query: string, root: string) => Promise<SearchResult[]>
    createFile: (parentDir: string, name: string) => Promise<string>
    createDirectory: (parentDir: string, name: string) => Promise<string>
    rename: (targetPath: string, newName: string) => Promise<string>
    delete: (targetPath: string) => Promise<void>
    revealInExplorer: (targetPath: string) => Promise<void>
    onWorkspaceChanged: (callback: () => void) => () => void
  }
  terminal: {
    create: (cwd?: string) => Promise<string>
    write: (id: string, data: string) => void
    resize: (id: string, cols: number, rows: number) => void
    destroy: (id: string) => Promise<void>
    onData: (callback: (id: string, data: string) => void) => () => void
  }
  agent: {
    send: (message: string, context: AgentContext) => Promise<void>
    abort: () => Promise<void>
    approve: (approvalId: string, approved: boolean) => Promise<void>
    setSessionAutoApprove: (toolName: string) => Promise<void>
    getRunCheckpoint: () => Promise<import('./types').RunCheckpointSummary | null>
    restoreRunCheckpoint: () => Promise<{ restored: number; deleted: number } | null>
    onEvent: (callback: (event: AgentEvent) => void) => () => void
  }
  chat: {
    load: (mode: string, workspacePath?: string | null) => Promise<import('./types').ChatMessage[]>
    save: (
      mode: string,
      messages: import('./types').ChatMessage[],
      workspacePath?: string | null
    ) => Promise<void>
  }
  analytics: {
    getRuns: (limit?: number) => Promise<AgentRunAnalytics[]>
    openLogs: () => Promise<void>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
  }
  index: {
    getStatus: () => Promise<IndexStatus>
    rebuild: () => Promise<IndexStatus>
    search: (request: CodebaseSearchRequest) => Promise<CodebaseSearchHit[]>
    onProgress: (callback: (progress: IndexProgress) => void) => () => void
    onStatus: (callback: (status: IndexStatus) => void) => () => void
    onFilesChanged: (callback: (paths: string[]) => void) => () => void
  }
  mcp: {
    getStatus: () => Promise<McpStatusSnapshot>
    getConfig: () => Promise<McpServerConfig[]>
    saveConfig: (servers: McpServerConfig[]) => Promise<McpServerConfig[]>
    importFromFile: (filePath?: string) => Promise<McpServerConfig[] | null>
    importDefaultCursor: () => Promise<McpServerConfig[]>
    testServer: (config: McpServerConfig) => Promise<{ ok: boolean; toolCount: number; error?: string }>
    reconnect: () => Promise<McpStatusSnapshot>
    onStatusChanged: (callback: (status: McpStatusSnapshot) => void) => () => void
  }
  memory: {
    getSnapshot: (workspacePath?: string) => Promise<string>
    listEntries: (workspacePath?: string) => Promise<ProjectMemoryEntry[]>
    saveEntries: (
      entries: ProjectMemoryEntry[],
      workspacePath?: string
    ) => Promise<ProjectMemoryEntry[]>
    remember: (
      input: { content: string; category?: ProjectMemoryCategory; source?: 'user' | 'remember' },
      workspacePath?: string
    ) => Promise<ProjectMemoryEntry>
  }
  app: {
    onFlushRequest: (callback: () => void) => () => void
    flushComplete: () => void
  }
}

const api: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings)
  },
  models: {
    list: () => ipcRenderer.invoke('models:list')
  },
  fs: {
    openFolder: () => ipcRenderer.invoke('fs:open-folder'),
    setWorkspace: (path) => ipcRenderer.invoke('fs:set-workspace', path),
    listWorkspaceFiles: () => ipcRenderer.invoke('fs:list-workspace-files'),
    readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
    readFileDataUrl: (path) => ipcRenderer.invoke('fs:read-file-data-url', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:write-file', path, content),
    listDir: (path) => ipcRenderer.invoke('fs:list-dir', path),
    searchFiles: (query, root) => ipcRenderer.invoke('fs:search-files', query, root),
    createFile: (parentDir, name) => ipcRenderer.invoke('fs:create-file', parentDir, name),
    createDirectory: (parentDir, name) =>
      ipcRenderer.invoke('fs:create-directory', parentDir, name),
    rename: (targetPath, newName) => ipcRenderer.invoke('fs:rename', targetPath, newName),
    delete: (targetPath) => ipcRenderer.invoke('fs:delete', targetPath),
    revealInExplorer: (targetPath) => ipcRenderer.invoke('fs:reveal-in-explorer', targetPath),
    onWorkspaceChanged: (callback) => {
      const handler = (): void => callback()
      ipcRenderer.on('fs:changed', handler)
      return () => ipcRenderer.removeListener('fs:changed', handler)
    }
  },
  terminal: {
    create: (cwd) => ipcRenderer.invoke('terminal:create', cwd),
    write: (id, data) => ipcRenderer.send('terminal:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),
    destroy: (id) => ipcRenderer.invoke('terminal:destroy', id),
    onData: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, data: string) =>
        callback(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    }
  },
  agent: {
    send: (message, context) => ipcRenderer.invoke('agent:send', message, context),
    abort: () => ipcRenderer.invoke('agent:abort'),
    approve: (approvalId, approved) =>
      ipcRenderer.invoke('agent:approve', approvalId, approved),
    setSessionAutoApprove: (toolName) =>
      ipcRenderer.invoke('agent:set-session-auto-approve', toolName),
    getRunCheckpoint: () => ipcRenderer.invoke('agent:getRunCheckpoint'),
    restoreRunCheckpoint: () => ipcRenderer.invoke('agent:restoreRunCheckpoint'),
    onEvent: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: AgentEvent) => callback(data)
      ipcRenderer.on('agent:event', handler)
      return () => ipcRenderer.removeListener('agent:event', handler)
    }
  },
  chat: {
    load: (mode, workspacePath) => ipcRenderer.invoke('chat:load', mode, workspacePath),
    save: (mode, messages, workspacePath) =>
      ipcRenderer.invoke('chat:save', mode, messages, workspacePath)
  },
  analytics: {
    getRuns: (limit) => ipcRenderer.invoke('analytics:get-runs', limit),
    openLogs: () => ipcRenderer.invoke('analytics:open-logs')
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
  },
  index: {
    getStatus: () => ipcRenderer.invoke('index:get-status'),
    rebuild: () => ipcRenderer.invoke('index:rebuild'),
    search: (request) => ipcRenderer.invoke('index:search', request),
    onProgress: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: IndexProgress) => callback(progress)
      ipcRenderer.on('index:progress', handler)
      return () => ipcRenderer.removeListener('index:progress', handler)
    },
    onStatus: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, status: IndexStatus) => callback(status)
      ipcRenderer.on('index:status', handler)
      return () => ipcRenderer.removeListener('index:status', handler)
    },
    onFilesChanged: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, paths: string[]) => callback(paths)
      ipcRenderer.on('index:files-changed', handler)
      return () => ipcRenderer.removeListener('index:files-changed', handler)
    }
  },
  mcp: {
    getStatus: () => ipcRenderer.invoke('mcp:getStatus'),
    getConfig: () => ipcRenderer.invoke('mcp:getConfig'),
    saveConfig: (servers) => ipcRenderer.invoke('mcp:saveConfig', servers),
    importFromFile: (filePath) => ipcRenderer.invoke('mcp:importFromFile', filePath),
    importDefaultCursor: () => ipcRenderer.invoke('mcp:importDefaultCursor'),
    testServer: (config) => ipcRenderer.invoke('mcp:testServer', config),
    reconnect: () => ipcRenderer.invoke('mcp:reconnect'),
    onStatusChanged: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, status: McpStatusSnapshot) =>
        callback(status)
      ipcRenderer.on('mcp:status-changed', handler)
      return () => ipcRenderer.removeListener('mcp:status-changed', handler)
    }
  },
  memory: {
    getSnapshot: (workspacePath) => ipcRenderer.invoke('memory:getSnapshot', workspacePath),
    listEntries: (workspacePath) => ipcRenderer.invoke('memory:listEntries', workspacePath),
    saveEntries: (entries, workspacePath) =>
      ipcRenderer.invoke('memory:saveEntries', entries, workspacePath),
    remember: (input, workspacePath) => ipcRenderer.invoke('memory:remember', input, workspacePath)
  },
  app: {
    onFlushRequest: (callback) => {
      const handler = (): void => callback()
      ipcRenderer.on('app:flush-request', handler)
      return () => ipcRenderer.removeListener('app:flush-request', handler)
    },
    flushComplete: () => ipcRenderer.send('app:flush-complete')
  }
}

contextBridge.exposeInMainWorld('api', api)
