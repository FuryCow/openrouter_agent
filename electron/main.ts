import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import Store from 'electron-store'
import { FileSystemService } from './services/filesystem'
import { WorkspaceWatcher } from './services/workspace-watcher'
import { TerminalService } from './services/terminal'
import { WebSearchService } from './services/websearch'
import { CodebaseIndexer } from './services/indexing/codebase-indexer'
import { DEFAULT_INDEX_SETTINGS } from './services/indexing/index-types'
import { OpenRouterClient } from './services/openrouter'
import { AgentService } from './services/agent'
import type { AgentContext, AppSettings, ModelInfo } from './types'
import {
  assertAllowedWorkspace,
  assertPathNotInAgentApp,
  isInsideAgentApp
} from './services/workspace-safety'
import { getRecentAnalyticsRuns, getAnalyticsLogDir } from './services/tool-analytics'
import { loadChatMessages, saveChatMessages } from './services/chat-persistence'
import { modeRequiresWorkspace } from './services/agent-modes'
import { withRecentWorkspace } from './lib/recent-workspaces'

function sanitizeSettings(settings: AppSettings): AppSettings {
  const { modelsByMode: _legacyModes, maxTokens: _legacyMaxTokens, ...clean } =
    settings as AppSettings & {
      modelsByMode?: Partial<Record<string, string>>
    }
  let normalized = clean as AppSettings

  if (normalized.workingDirectory && isInsideAgentApp(normalized.workingDirectory)) {
    normalized = { ...normalized, workingDirectory: '' }
  }
  return normalized
}

const store = new Store<{ settings: AppSettings }>({
  defaults: {
    settings: {
      apiKey: '',
      model: 'anthropic/claude-sonnet-4',
      workingDirectory: ''
    }
  }
})

let mainWindow: BrowserWindow | null = null
const codebaseIndexer = new CodebaseIndexer()
const fsService = new FileSystemService()
fsService.setIndexer(codebaseIndexer)
const workspaceWatcher = new WorkspaceWatcher()
const terminalService = new TerminalService()
const webSearchService = new WebSearchService()
let openRouterClient = new OpenRouterClient(store.get('settings'))
let agentService = new AgentService(openRouterClient, fsService, terminalService, webSearchService, codebaseIndexer)
webSearchService.configure(store.get('settings'))

function applyIndexSettings(settings: AppSettings): void {
  codebaseIndexer.setSettings({
    indexOnOpen: settings.indexOnOpen ?? DEFAULT_INDEX_SETTINGS.indexOnOpen,
    embeddingModel: settings.embeddingModel ?? DEFAULT_INDEX_SETTINGS.embeddingModel,
    maxFileSizeKb: settings.maxFileSizeKb ?? DEFAULT_INDEX_SETTINGS.maxFileSizeKb,
    semanticSearchEnabled: settings.semanticSearchEnabled ?? DEFAULT_INDEX_SETTINGS.semanticSearchEnabled
  })
}

function resolveAppIcon(): string | undefined {
  const candidates = [
    join(process.cwd(), 'build/icon.png'),
    join(__dirname, '../../build/icon.png')
  ]
  return candidates.find((path) => existsSync(path))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    icon: resolveAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', () => {
    shutdownApp()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function getWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Main window not ready')
  return mainWindow
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    mainWindow.webContents.send(channel, ...args)
  } catch {
    // Window was destroyed during shutdown
  }
}

function applyWorkspaceSelection(workspacePath: string): AppSettings {
  assertAllowedWorkspace(workspacePath)
  const next = withRecentWorkspace(sanitizeSettings(store.get('settings')), workspacePath)
  store.set('settings', next)
  setWorkspaceWatch(workspacePath)
  return next
}

function setWorkspaceWatch(dir: string): void {
  if (!dir || isInsideAgentApp(dir)) {
    workspaceWatcher.stop()
    void codebaseIndexer.setWorkspace(null)
    return
  }

  void codebaseIndexer.setWorkspace(dir).catch((err) => {
    console.error('[Index] Failed to open workspace index:', err)
  })

  setTimeout(() => {
    try {
      workspaceWatcher.watch(dir, (changedPaths) => {
        sendToRenderer('fs:changed')
        sendToRenderer('index:files-changed', changedPaths)
        codebaseIndexer.queueChangedPaths(changedPaths)
      })
    } catch (err) {
      console.error('[Workspace] Failed to watch directory:', err)
    }
  }, 500)
}

function shutdownApp(): void {
  agentService.abort()
  workspaceWatcher.stop()
  terminalService.destroyAll()
  mainWindow = null
}

function registerIpc(): void {
  ipcMain.handle('window:minimize', () => getWindow().minimize())
  ipcMain.handle('window:maximize', () => {
    const win = getWindow()
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('window:close', () => getWindow().close())

  ipcMain.handle('settings:get', () => sanitizeSettings(store.get('settings')))
  ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
    if (agentService.isRunning) {
      throw new Error('Cannot save settings while agent is running. Abort the current run first.')
    }
    const normalized = sanitizeSettings({
      ...settings,
      apiKey: settings.apiKey.trim()
    })
    store.set('settings', normalized)
    openRouterClient = new OpenRouterClient(normalized)
    webSearchService.configure(normalized)
    applyIndexSettings(normalized)
    agentService = new AgentService(openRouterClient, fsService, terminalService, webSearchService, codebaseIndexer)
    return normalized
  })

  ipcMain.handle('models:list', async () => {
    const models = await openRouterClient.listModels()
    console.log(
      `[OpenRouter Agent] Loaded ${models.length} models. Example: ${models[0]?.id} → ${models[0]?.priceLabel}`
    )
    return JSON.parse(JSON.stringify(models)) as ModelInfo[]
  })

  ipcMain.handle('fs:open-folder', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return applyWorkspaceSelection(result.filePaths[0]).workingDirectory
  })

  ipcMain.handle('fs:set-workspace', (_event, workspacePath: string) => {
    if (!workspacePath || typeof workspacePath !== 'string') {
      throw new Error('Workspace path is required')
    }
    return applyWorkspaceSelection(workspacePath).workingDirectory
  })

  ipcMain.handle('fs:list-workspace-files', async () => {
    return codebaseIndexer.listWorkspaceFiles()
  })

  ipcMain.handle('fs:read-file', (_event, filePath: string) => {
    assertPathNotInAgentApp(filePath)
    return fsService.readFile(filePath)
  })
  ipcMain.handle('fs:write-file', (_event, filePath: string, content: string) => {
    assertPathNotInAgentApp(filePath)
    return fsService.writeFile(filePath, content)
  })
  ipcMain.handle('fs:list-dir', (_event, dirPath: string) => {
    assertPathNotInAgentApp(dirPath)
    return fsService.listDir(dirPath)
  })
  ipcMain.handle('fs:search-files', (_event, query: string, root: string) => {
    assertPathNotInAgentApp(root)
    return fsService.searchFiles(query, root)
  })
  ipcMain.handle('fs:create-file', (_event, parentDir: string, name: string) => {
    const filePath = join(parentDir, name)
    assertPathNotInAgentApp(parentDir)
    assertPathNotInAgentApp(filePath)
    return fsService.createFile(parentDir, name)
  })
  ipcMain.handle('fs:create-directory', (_event, parentDir: string, name: string) => {
    const dirPath = join(parentDir, name)
    assertPathNotInAgentApp(parentDir)
    assertPathNotInAgentApp(dirPath)
    return fsService.createDirectory(parentDir, name)
  })
  ipcMain.handle('fs:rename', (_event, targetPath: string, newName: string) => {
    const newPath = join(dirname(targetPath), newName)
    assertPathNotInAgentApp(targetPath)
    assertPathNotInAgentApp(newPath)
    return fsService.renamePath(targetPath, newName)
  })
  ipcMain.handle('fs:delete', (_event, targetPath: string) => {
    assertPathNotInAgentApp(targetPath)
    return fsService.deletePath(targetPath)
  })
  ipcMain.handle('fs:reveal-in-explorer', async (_event, targetPath: string) => {
    assertPathNotInAgentApp(targetPath)
    if (await fsService.isDirectory(targetPath)) {
      await shell.openPath(targetPath)
    } else {
      shell.showItemInFolder(targetPath)
    }
  })

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    if (typeof url !== 'string') return
    if (!url.startsWith('http://') && !url.startsWith('https://')) return
    await shell.openExternal(url)
  })

  ipcMain.handle('terminal:create', (_event, cwd?: string) => {
    if (cwd) assertAllowedWorkspace(cwd)
    return terminalService.create(cwd)
  })
  ipcMain.on('terminal:write', (_event, id: string, data: string) => terminalService.write(id, data))
  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) =>
    terminalService.resize(id, cols, rows)
  )
  ipcMain.handle('terminal:destroy', (_event, id: string) => terminalService.destroy(id))

  ipcMain.handle('agent:send', async (_event, message: string, context: AgentContext) => {
    if (agentService.isRunning) {
      sendToRenderer('agent:event', {
        type: 'error',
        error: 'Agent is already running. Wait or abort the current run.'
      })
      return
    }

    const settings = sanitizeSettings(store.get('settings'))
    const cwd = settings.workingDirectory || context.workingDirectory
    const mode = context.mode ?? 'agent'
    const model = context.model || settings.model

    if (modeRequiresWorkspace(mode) && !cwd) {
      sendToRenderer('agent:event', {
        type: 'error',
        error: 'No workspace folder open. Open a project folder in Explorer (not the agent app folder).'
      })
      return
    }

    if (modeRequiresWorkspace(mode) && cwd) {
      try {
        assertAllowedWorkspace(cwd)
      } catch (err) {
        sendToRenderer('agent:event', {
          type: 'error',
          error: err instanceof Error ? err.message : String(err)
        })
        return
      }
    }

    await agentService.run(
      message,
      {
        ...context,
        mode,
        workingDirectory: cwd,
        model,
        temperature: context.temperature ?? settings.temperature,
        maxTokens: context.maxTokens,
        customSystemPrompt: context.customSystemPrompt ?? settings.customSystemPrompt,
        autoApproveWrites: context.autoApproveWrites ?? settings.autoApproveWrites,
        autoApproveTerminal: context.autoApproveTerminal ?? settings.autoApproveTerminal
      },
      (event) => {
        sendToRenderer('agent:event', event)
      }
    )
  })

  ipcMain.handle('agent:approve', (_event, approvalId: string, approved: boolean) => {
    agentService.resolveApproval(approvalId, approved)
  })

  ipcMain.handle('agent:set-session-auto-approve', (_event, toolName: string) => {
    agentService.setSessionAutoApprove(toolName)
  })

  ipcMain.handle('agent:abort', () => {
    agentService.abort()
  })

  ipcMain.handle('chat:load', (_event, mode: string) => {
    return loadChatMessages(mode as import('./types').ChatMode)
  })

  ipcMain.handle('chat:save', async (_event, mode: string, messages: import('./types').ChatMessage[]) => {
    await saveChatMessages(mode as import('./types').ChatMode, messages)
  })

  ipcMain.handle('analytics:get-runs', (_event, limit?: number) => {
    return getRecentAnalyticsRuns(limit ?? 20)
  })

  ipcMain.handle('analytics:open-logs', async () => {
    const logDir = getAnalyticsLogDir()
    await shell.openPath(logDir)
  })

  ipcMain.handle('index:get-status', () => codebaseIndexer.getStatus())
  ipcMain.handle('index:rebuild', async () => {
    await codebaseIndexer.rebuild()
    return codebaseIndexer.getStatus()
  })
  ipcMain.handle('index:search', async (_event, request: import('./types').CodebaseSearchRequest) => {
    return codebaseIndexer.search(request)
  })
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.openrouter.agent')
  }

  const settings = sanitizeSettings(store.get('settings'))
  if (settings.workingDirectory !== store.get('settings').workingDirectory) {
    store.set('settings', settings)
  }

  terminalService.onData((id, data) => {
    sendToRenderer('terminal:data', id, data)
  })

  registerIpc()
  createWindow()
  applyIndexSettings(settings)
  codebaseIndexer.onProgress((progress) => {
    sendToRenderer('index:progress', progress)
    sendToRenderer('index:status', codebaseIndexer.getStatus())
  })

  const workspaceDir = settings.workingDirectory
  const attachWorkspace = (): void => setWorkspaceWatch(workspaceDir)
  if (mainWindow?.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', attachWorkspace)
  } else {
    attachWorkspace()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  shutdownApp()
})
