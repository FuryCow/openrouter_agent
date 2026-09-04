import { contextBridge, ipcRenderer } from 'electron'
import type {
  AgentContext,
  AgentEvent,
  AgentRunAnalytics,
  AppSettings,
  DirEntry,
  ModelInfo,
  SearchResult
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
    readFile: (path: string) => Promise<string>
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
    onEvent: (callback: (event: AgentEvent) => void) => () => void
  }
  chat: {
    load: (mode: string) => Promise<import('./types').ChatMessage[]>
    save: (mode: string, messages: import('./types').ChatMessage[]) => Promise<void>
  }
  analytics: {
    getRuns: (limit?: number) => Promise<AgentRunAnalytics[]>
    openLogs: () => Promise<void>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
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
    readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
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
    onEvent: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: AgentEvent) => callback(data)
      ipcRenderer.on('agent:event', handler)
      return () => ipcRenderer.removeListener('agent:event', handler)
    }
  },
  chat: {
    load: (mode) => ipcRenderer.invoke('chat:load', mode),
    save: (mode, messages) => ipcRenderer.invoke('chat:save', mode, messages)
  },
  analytics: {
    getRuns: (limit) => ipcRenderer.invoke('analytics:get-runs', limit),
    openLogs: () => ipcRenderer.invoke('analytics:open-logs')
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
  }
}

contextBridge.exposeInMainWorld('api', api)
