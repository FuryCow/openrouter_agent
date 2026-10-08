import { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } from 'electron'
import { join, dirname } from 'path'
import { existsSync, readFileSync } from 'fs'
import Store from 'electron-store'
import { FileSystemService } from './services/filesystem'
import { WorkspaceWatcher } from './services/workspace-watcher'
import { TerminalService } from './services/terminal'
import { WebSearchService } from './services/websearch'
import { CodebaseIndexer } from './services/indexing/codebase-indexer'
import { DEFAULT_INDEX_SETTINGS } from './services/indexing/index-types'
import { OpenRouterClient } from './services/openrouter'
import { fetchModelEndpoints } from './services/models'
import { AgentService } from './services/agent'
import type { AgentContext, AppSettings, ModelInfo, McpServerConfig } from './types'
import {
  assertAllowedWorkspace,
  assertPathNotInAgentApp,
  isInsideAgentApp
} from './services/workspace-safety'
import { getRecentAnalyticsRuns, getAnalyticsLogDir } from './services/tool-analytics'
import { loadChatMessages, saveChatMessages } from './services/chat-persistence'
import { settingsSaveEffects } from './lib/settings-save'
import { writePlannerPlan } from './services/planner-plans'
import { modeRequiresWorkspace } from './services/agent-modes'
import { withRecentWorkspace } from './lib/recent-workspaces'
import { McpManager } from './services/mcp/mcp-manager'
import {
  getDefaultCursorMcpPath,
  getWorkspaceCursorMcpPath,
  mergeMcpServerConfigs,
  parseCursorMcpJson,
  readWorkspaceMcpOverride,
  resolveWorkspaceMcpServers,
  scheduleWorkspaceMcpReconnect,
  writeWorkspaceMcpOverride,
  validateMcpServerConfigs
} from './services/mcp/mcp-config'
import { ProjectMemoryService } from './services/project-memory/project-memory-service'
import type { ProjectMemoryCategory, ProjectMemoryEntry } from './types'
import { getWorkspaceState } from './services/workspace-state'
import { AppError, AppErrorCode, getAppErrorPayload } from './lib/app-errors'
import { homedir } from 'os'
import { SkillLoader } from './services/skills/skill-loader'
import {
  UpdateChecker,
  downloadInstaller,
  pickInstallerAsset,
  scheduleStartupUpdateCheck,
  shouldNotifyForUpdate
} from './services/update-checker'
import { distillSessionIntoSkill } from './services/skills/skill-distill-runner'
import { RunQueueService } from './services/run-queue'
import type { QueueEnqueueInput } from './types'

// Allow a second dev instance to use an isolated userData directory (worktree runs).
const userDataOverride = process.env['OPENROUTER_AGENT_USER_DATA']?.trim()
if (userDataOverride) {
  app.setPath('userData', userDataOverride)
}

function sanitizeSettings(settings: AppSettings): AppSettings {
  const { modelsByMode: _legacyModes, maxTokens: _legacyMaxTokens, ...clean } =
    settings as AppSettings & {
      modelsByMode?: Partial<Record<string, string>>
    }
  let normalized = clean as AppSettings

  if (normalized.workingDirectory && isInsideAgentApp(normalized.workingDirectory)) {
    normalized = { ...normalized, workingDirectory: '' }
  }
  if (!normalized.locale) {
    normalized = { ...normalized, locale: 'en' }
  }
  return normalized
}

const store = new Store<{ settings: AppSettings }>({
  defaults: {
    settings: {
      apiKey: '',
      model: 'anthropic/claude-sonnet-4',
      workingDirectory: '',
      locale: 'en'
    }
  }
})

let mainWindow: BrowserWindow | null = null
let rendererAlive = true
let closeConfirmed = false
let closeFlushTimer: ReturnType<typeof setTimeout> | null = null
const codebaseIndexer = new CodebaseIndexer()
const fsService = new FileSystemService()
fsService.setIndexer(codebaseIndexer)
const workspaceWatcher = new WorkspaceWatcher()
const terminalService = new TerminalService()
const webSearchService = new WebSearchService()
let openRouterClient = new OpenRouterClient(store.get('settings'))
const mcpManager = new McpManager(
  () => {
    const settings = sanitizeSettings(store.get('settings'))
    const resolved = resolveWorkspaceMcpServers(settings.mcpServers ?? [], settings.workingDirectory)
    return { ...settings, mcpServers: resolved.servers, mcpConfigError: resolved.error }
  },
  (status) => sendToRenderer('mcp:status-changed', status)
)
const projectMemoryService = new ProjectMemoryService(app.getPath('userData'))
const skillLoader = new SkillLoader(join(homedir(), '.openrouter_agent', 'skills'))
const updateChecker = new UpdateChecker()
function createAgentService(): AgentService {
  return new AgentService(
    openRouterClient,
    fsService,
    terminalService,
    webSearchService,
    codebaseIndexer,
    mcpManager,
    projectMemoryService,
    skillLoader
  )
}

let agentService = createAgentService()
const runQueue = new RunQueueService({
  createAgentService,
  buildAgentContext: (overrides) => buildAgentContext(overrides, sanitizeSettings(store.get('settings'))),
  emit: (event) => sendToRenderer('agent:event', event),
  isForegroundRunning: () => agentService.isRunning,
  statePath: join(app.getPath('userData'), 'queue-state.json')
})
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

  mainWindow.on('close', (event) => {
    if (closeConfirmed) {
      shutdownApp()
      return
    }

    event.preventDefault()
    requestRendererFlushAndClose()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  mainWindow.webContents.on('render-process-gone', () => {
    rendererAlive = false
    agentService.abort()
    void runQueue.abortAll('renderer-gone')
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.reload()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    rendererAlive = true
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (!input.control && !input.meta) return
    if (!input.shift || input.key.toLowerCase() !== 'i') return
    event.preventDefault()
    mainWindow?.webContents.toggleDevTools()
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    // Dev only: right after the vite banner the server can briefly refuse connections
    // (port race with a dying previous instance). Retry instead of a permanent grey window.
    const loadRendererWithRetry = async (attempt: number = 0): Promise<void> => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      try {
        await mainWindow.loadURL(rendererUrl)
      } catch (err) {
        const description = String((err as { code?: string; message?: string })?.code ?? err)
        const transient =
          attempt < 9 &&
          /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE/i.test(description)
        if (transient) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          await loadRendererWithRetry(attempt + 1)
        } else {
          console.error('[main] Failed to load renderer URL:', err)
        }
      }
    }
    void loadRendererWithRetry()
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function getWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Main window not ready')
  return mainWindow
}

function canSendToRenderer(): boolean {
  if (!rendererAlive) return false
  if (!mainWindow || mainWindow.isDestroyed()) return false
  const contents = mainWindow.webContents
  if (contents.isDestroyed() || contents.isCrashed()) return false
  return true
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  if (!canSendToRenderer()) {
    if (agentService.isRunning) agentService.abort()
    return
  }
  try {
    mainWindow!.webContents.send(channel, ...args)
  } catch {
    if (agentService.isRunning) agentService.abort()
  }
}

function finishAppClose(): void {
  if (closeFlushTimer) {
    clearTimeout(closeFlushTimer)
    closeFlushTimer = null
  }
  closeConfirmed = true
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.close()
}

function requestRendererFlushAndClose(): void {
  sendToRenderer('app:flush-request')
  if (closeFlushTimer) clearTimeout(closeFlushTimer)
  closeFlushTimer = setTimeout(() => finishAppClose(), 3000)
}

function sendToRendererSafe(channel: string, ...args: unknown[]): void {
  try {
    if (canSendToRenderer()) mainWindow!.webContents.send(channel, ...args)
  } catch {
    // Renderer is gone — nothing to notify; queue state persists on disk.
  }
}

function applyWorkspaceSelection(workspacePath: string): AppSettings {
  assertAllowedWorkspace(workspacePath)
  const next = withRecentWorkspace(sanitizeSettings(store.get('settings')), workspacePath)
  store.set('settings', next)
  setWorkspaceWatch(workspacePath)
  void Promise.resolve(scheduleWorkspaceMcpReconnect(agentService.isRunning, mcpManager)).catch((err) => {
    console.error('[MCP] Failed to reconnect after workspace change:', err)
  })
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
        void codebaseIndexer
          .filterChangedPaths(changedPaths)
          .then((relevantPaths) => {
            if (relevantPaths.length === 0) return
            projectMemoryService.invalidateByChangedPaths(dir, relevantPaths)
            sendToRenderer('fs:changed')
            codebaseIndexer.queueChangedPaths(relevantPaths)
          })
          .catch((err) => {
            console.error('[Index] Failed to filter changed paths:', err)
          })
      })
    } catch (err) {
      console.error('[Workspace] Failed to watch directory:', err)
    }
  }, 500)
}

function getCurrentWorkspace(): string {
  return sanitizeSettings(store.get('settings')).workingDirectory ?? ''
}

function shutdownApp(): void {
  agentService.abort()
  void runQueue.abortAll('shutdown')
  workspaceWatcher.stop()
  terminalService.destroyAll()
  void mcpManager.shutdown()
  mainWindow = null
}

function assertQueueEnabled(): void {
  const settings = sanitizeSettings(store.get('settings'))
  if (settings.runQueueEnabled !== true) {
    throw new AppError(AppErrorCode.QUEUE_DISABLED)
  }
}

function buildAgentContext(overrides: Partial<AgentContext>, settings: AppSettings): AgentContext {
  const cwd = overrides.workingDirectory || settings.workingDirectory
  const mode = overrides.mode ?? 'agent'
  const model = overrides.model || settings.model

  return {
    ...overrides,
    mode,
    workingDirectory: cwd,
    model,
    history: overrides.history ?? [],
    openFiles: overrides.openFiles ?? [],
    temperature: overrides.temperature ?? settings.temperature,
    maxTokens: overrides.maxTokens,
    reasoningEffort: overrides.reasoningEffort ?? settings.reasoningEffort,
    modelProvider: overrides.modelProvider ?? settings.modelProvider,
    reasoningMandatory: overrides.reasoningMandatory,
    reasoningDefaultEffort: overrides.reasoningDefaultEffort,
    reasoningSupportedEfforts: overrides.reasoningSupportedEfforts,
    customSystemPrompt: overrides.customSystemPrompt ?? settings.customSystemPrompt,
    autoApproveWrites: overrides.autoApproveWrites ?? settings.autoApproveWrites,
    autoApproveTerminal: overrides.autoApproveTerminal ?? settings.autoApproveTerminal,
    agentAutoVerify: settings.agentAutoVerify !== false,
    skillsEnabled: settings.skillsEnabled === true,
    runQueueEnabled: settings.runQueueEnabled === true,
    workspaceState: mode !== 'ask' && cwd ? getWorkspaceState(cwd).formatted : undefined,
    projectMemory:
      settings.projectMemoryEnabled !== false && cwd && (mode === 'agent' || mode === 'planner')
        ? projectMemoryService.getSnapshot(cwd, {
            includeDocs: settings.projectMemoryAutoLoadDocs !== false,
            includeCursorRules: settings.projectMemoryAutoLoadDocs !== false
          })
        : undefined
  }
}

function registerIpc(): void {
  ipcMain.on('app:flush-complete', () => {
    finishAppClose()
  })
  ipcMain.handle('app:get-version', () => app.getVersion())

  ipcMain.handle('updates:check', async () => {
    const settings = sanitizeSettings(store.get('settings'))
    const result = await updateChecker.check(app.getVersion())
    if (result.update && shouldNotifyForUpdate(result.update, settings)) {
      sendToRenderer('updates:available', result.update)
    }
    return result.update
  })

  ipcMain.handle('updates:get-cached', () => {
    const settings = sanitizeSettings(store.get('settings'))
    const update = updateChecker.getCached(app.getVersion())
    if (update && shouldNotifyForUpdate(update, settings)) return update
    return null
  })

  ipcMain.handle('updates:dismiss', (_event, version: string) => {
    if (!version || typeof version !== 'string') return
    const settings = sanitizeSettings(store.get('settings'))
    store.set('settings', { ...settings, updateNotificationDismissedFor: version })
  })

  let installInFlight = false
  ipcMain.handle('updates:install', async (_event, update: import('./types').UpdateInfo) => {
    if (installInFlight) return { ok: false, error: 'already_running' }
    installInFlight = true
    try {
      const asset = pickInstallerAsset(
        update.assets ?? [],
        process.platform,
        process.arch
      )
      if (!asset) return { ok: false, error: 'no_matching_installer' }
      const filePath = await downloadInstaller(asset, (progress) => {
        sendToRenderer('updates:download-progress', {
          version: update.version,
          percent: progress.percent,
          received: progress.received,
          total: progress.total
        })
      })
      await shell.openPath(filePath)
      return { ok: true }
    } catch (err) {
      console.error('[Updates] Install failed:', err)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    } finally {
      installInFlight = false
    }
  })

  ipcMain.handle('window:minimize', () => getWindow().minimize())
  ipcMain.handle('window:maximize', () => {
    const win = getWindow()
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle('window:close', () => getWindow().close())

  ipcMain.handle('settings:get', () => sanitizeSettings(store.get('settings')))
  ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
    if (agentService.isRunning || runQueue.hasActiveRuns()) {
      throw new AppError(AppErrorCode.SETTINGS_SAVE_WHILE_RUNNING)
    }
    const normalized = sanitizeSettings({
      ...settings,
      apiKey: settings.apiKey.trim()
    })
    const previous = sanitizeSettings(store.get('settings'))
    const mcpChanged =
      JSON.stringify(previous.mcpServers ?? []) !== JSON.stringify(normalized.mcpServers ?? [])
    store.set('settings', normalized)
    const effects = settingsSaveEffects(previous, normalized)
    if (effects.refreshModelClient) openRouterClient.updateSettings(normalized)
    if (effects.refreshSearch) webSearchService.configure(normalized)
    if (effects.refreshIndex) applyIndexSettings(normalized)
    if (mcpChanged) await mcpManager.applyConfigFromSettings()
    return normalized
  })

  ipcMain.handle('models:list', async () => {
    const models = await openRouterClient.listModels()
    console.log(
      `[OpenRouter Agent] Loaded ${models.length} models. Example: ${models[0]?.id} → ${models[0]?.priceLabel}`
    )
    return JSON.parse(JSON.stringify(models)) as ModelInfo[]
  })

  ipcMain.handle('models:endpoints', async (_event, modelId: string) => {
    if (!modelId || typeof modelId !== 'string') return []
    const settings = sanitizeSettings(store.get('settings'))
    const endpoints = await fetchModelEndpoints(modelId, settings.apiKey)
    return endpoints
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
      throw new AppError(AppErrorCode.WORKSPACE_PATH_REQUIRED)
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
  ipcMain.handle('fs:read-file-data-url', (_event, filePath: string) => {
    assertPathNotInAgentApp(filePath)
    return fsService.readFileAsDataUrl(filePath)
  })
  ipcMain.handle('fs:write-file', (_event, filePath: string, content: string) => {
    assertPathNotInAgentApp(filePath)
    return fsService.writeFile(filePath, content)
  })
  ipcMain.handle('fs:save-planner-plan', async (_event, markdown: string, workspacePath?: string) => {
    const workspace = workspacePath?.trim() || getCurrentWorkspace()
    if (!workspace) throw new Error('No workspace open')
    assertAllowedWorkspace(workspace)
    return writePlannerPlan(workspace, markdown)
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
        ...getAppErrorPayload(new AppError(AppErrorCode.AGENT_ALREADY_RUNNING))
      })
      return
    }

    const settings = sanitizeSettings(store.get('settings'))
    const cwd = settings.workingDirectory || context.workingDirectory
    const mode = context.mode ?? 'agent'

    if (modeRequiresWorkspace(mode) && !cwd) {
      sendToRenderer('agent:event', {
        type: 'error',
        ...getAppErrorPayload(new AppError(AppErrorCode.AGENT_NO_WORKSPACE))
      })
      return
    }

    if (modeRequiresWorkspace(mode) && cwd) {
      try {
        assertAllowedWorkspace(cwd)
      } catch (err) {
        sendToRenderer('agent:event', {
          type: 'error',
          ...getAppErrorPayload(err)
        })
        return
      }
    }

    if (runQueue.hasActiveRuns()) {
      await runQueue.abortAll('foreground')
    }
    runQueue.setPaused(true, 'foreground')
    const settingsForRun = settings
    if (settingsForRun.runQueueEnabled === true) {
      agentService.setTaskEnqueuer(async (title, prompt, dependsOn) => {
        const created = runQueue.enqueue({ title, prompt, dependsOn, source: 'agent' })
        return { id: created.id, title: created.title, dependsOn: created.dependsOn }
      })
    }
    try {
      await agentService.run(message, buildAgentContext(context, settings), (event) => {
        sendToRenderer('agent:event', event)
      })
    } finally {
      agentService.setTaskEnqueuer(null)
      if (runQueue.getPaused() && runQueue.list().pausedReason === 'foreground') {
        runQueue.setPaused(false)
      }
    }
    await mcpManager.flushPendingReconnect()
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

  ipcMain.handle('queue:list', () => runQueue.list())

  ipcMain.handle('queue:enqueue', (_event, input: QueueEnqueueInput) => {
    assertQueueEnabled()
    if (input?.source === 'agent') throw new AppError(AppErrorCode.QUEUE_AGENT_SOURCE_FORBIDDEN)
    return runQueue.enqueue({ ...input, source: 'user' })
  })

  ipcMain.handle('queue:cancel', (_event, runId: string) => {
    assertQueueEnabled()
    return runQueue.cancel(String(runId ?? ''))
  })

  ipcMain.handle('queue:clearFinished', () => {
    assertQueueEnabled()
    runQueue.clearFinished()
    return runQueue.list()
  })

  ipcMain.handle('queue:approve', (_event, runId: string, approvalId: string, approved: boolean) => {
    assertQueueEnabled()
    runQueue.resolveApproval(String(runId ?? ''), String(approvalId ?? ''), approved === true)
    return runQueue.list()
  })

  ipcMain.handle('queue:getCheckpointDetails', async (_event, runId: string) => {
    assertQueueEnabled()
    return runQueue.getRunCheckpointDetails(String(runId ?? ''))
  })

  ipcMain.handle('queue:restoreRunCheckpoint', async (_event, runId: string, paths?: string[]) => {
    assertQueueEnabled()
    return runQueue.restoreRunCheckpoint(String(runId ?? ''), paths)
  })

  ipcMain.handle('queue:setPaused', (_event, paused: boolean) => {
    assertQueueEnabled()
    runQueue.setPaused(paused === true, 'user')
    return runQueue.list()
  })

  ipcMain.handle('agent:getRunCheckpoint', () => {
    return agentService.getRunCheckpointSummary()
  })

  ipcMain.handle('agent:getRunCheckpointDetails', async () => {
    return agentService.getRunCheckpointDetails()
  })

  ipcMain.handle('agent:restoreRunCheckpoint', async () => {
    return agentService.restoreRunCheckpoint()
  })

  ipcMain.handle('agent:restoreRunCheckpointPaths', async (_event, paths: string[]) => {
    return agentService.restoreRunCheckpointPaths(paths)
  })

  ipcMain.handle('chat:load', (_event, mode: string, workspacePath?: string | null) => {
    return loadChatMessages(mode as import('./types').ChatMode, workspacePath ?? getCurrentWorkspace())
  })

  ipcMain.handle(
    'chat:save',
    async (
      _event,
      mode: string,
      messages: import('./types').ChatMessage[],
      workspacePath?: string | null,
      allowEmpty?: boolean
    ) => {
      await saveChatMessages(
        mode as import('./types').ChatMode,
        messages,
        workspacePath ?? getCurrentWorkspace(),
        { allowEmpty: Boolean(allowEmpty) }
      )
    }
  )

  ipcMain.handle('memory:getSnapshot', (_event, workspacePath?: string) => {
    const workspace = workspacePath?.trim() || getCurrentWorkspace()
    if (!workspace) return ''
    const settings = sanitizeSettings(store.get('settings'))
    if (settings.projectMemoryEnabled === false) return ''
    return projectMemoryService.getSnapshot(workspace, {
      includeDocs: settings.projectMemoryAutoLoadDocs !== false,
      includeCursorRules: settings.projectMemoryAutoLoadDocs !== false
    })
  })

  ipcMain.handle('memory:listEntries', (_event, workspacePath?: string) => {
    const workspace = workspacePath?.trim() || getCurrentWorkspace()
    if (!workspace) return [] as ProjectMemoryEntry[]
    return projectMemoryService.listEntries(workspace)
  })

  ipcMain.handle(
    'memory:saveEntries',
    (_event, entries: ProjectMemoryEntry[], workspacePath?: string) => {
      const workspace = workspacePath?.trim() || getCurrentWorkspace()
      if (!workspace) throw new AppError(AppErrorCode.MEMORY_NO_WORKSPACE)
      return projectMemoryService.saveEntries(workspace, entries)
    }
  )

  ipcMain.handle(
    'memory:remember',
    (
      _event,
      input: { content: string; category?: ProjectMemoryCategory; source?: 'user' | 'remember' },
      workspacePath?: string
    ) => {
      const workspace = workspacePath?.trim() || getCurrentWorkspace()
      if (!workspace) throw new AppError(AppErrorCode.MEMORY_NO_WORKSPACE)
      const settings = sanitizeSettings(store.get('settings'))
      if (settings.projectMemoryEnabled === false) {
        throw new AppError(AppErrorCode.MEMORY_DISABLED)
      }
      const content = input.content?.trim()
      if (!content) throw new AppError(AppErrorCode.MEMORY_CONTENT_REQUIRED)
      return projectMemoryService.remember(workspace, {
        content,
        category: input.category ?? 'note',
        source: input.source ?? 'remember'
      })
    }
  )

  ipcMain.handle('skills:list', (_event, workspacePath?: string) => {
    const workspace = workspacePath?.trim() || getCurrentWorkspace()
    return skillLoader.listSkills(workspace || undefined)
  })

  ipcMain.handle('skills:read', (_event, path: string) => {
    return skillLoader.readSkill(path)
  })

  ipcMain.handle('skills:save', (_event, workspacePath: string, name: string, content: string) => {
    const workspace = workspacePath?.trim() || getCurrentWorkspace()
    if (!workspace) throw new AppError(AppErrorCode.WORKSPACE_PATH_REQUIRED)
    assertAllowedWorkspace(workspace)
    return skillLoader.saveSkill(workspace, name, content)
  })

  ipcMain.handle('skills:delete', (_event, path: string) => {
    return skillLoader.deleteSkill(path)
  })

  ipcMain.handle('skills:distill', async (_event, mode: string, workspacePath?: string) => {
    if (agentService.isRunning || runQueue.hasActiveRuns()) {
      throw new AppError(AppErrorCode.SETTINGS_SAVE_WHILE_RUNNING)
    }
    const workspace = workspacePath?.trim() || getCurrentWorkspace()
    if (!workspace) throw new AppError(AppErrorCode.WORKSPACE_PATH_REQUIRED)
    const chatMode = (mode || 'agent') as import('./types').ChatMode
    const messages = await loadChatMessages(chatMode, workspace)
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && m.runOutcome === 'success')
    if (!lastAssistant?.apiMessages?.length) {
      throw new Error('No successful agent run found in this chat to distill.')
    }
    const settings = sanitizeSettings(store.get('settings'))
    if (!openRouterClient.hasApiKey()) {
      throw new AppError(AppErrorCode.OPENROUTER_API_KEY_MISSING)
    }
    return distillSessionIntoSkill(
      openRouterClient,
      {
        apiMessages: lastAssistant.apiMessages,
        finalContent: lastAssistant.content,
        runAnalytics: lastAssistant.runAnalytics
      },
      { model: settings.model }
    )
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

  ipcMain.handle('mcp:getStatus', () => mcpManager.getStatus())
  ipcMain.handle('mcp:getConfig', () => mcpManager.getConfig())

  ipcMain.handle('mcp:getWorkspaceConfig', () => {
    const settings = sanitizeSettings(store.get('settings'))
    if (!settings.workingDirectory?.trim()) return { servers: [] as McpServerConfig[] }
    const override = readWorkspaceMcpOverride(settings.workingDirectory)
    return { servers: override.servers, error: override.error, overrideIds: override.servers.map((server) => server.id) }
  })

  ipcMain.handle('mcp:saveWorkspaceConfig', async (_event, servers: McpServerConfig[]) => {
    const settings = sanitizeSettings(store.get('settings'))
    if (!settings.workingDirectory?.trim()) {
      throw new AppError(AppErrorCode.WORKSPACE_PATH_REQUIRED)
    }
    writeWorkspaceMcpOverride(settings.workingDirectory, servers)
    await mcpManager.applyConfigFromSettings()
    const override = readWorkspaceMcpOverride(settings.workingDirectory)
    return { servers: override.servers, error: override.error }
  })

  ipcMain.handle('mcp:saveConfig', async (_event, servers: McpServerConfig[]) => {
    const error = validateMcpServerConfigs(servers)
    if (error) throw error

    const settings = sanitizeSettings(store.get('settings'))
    const next = { ...settings, mcpServers: servers }
    store.set('settings', next)
    await mcpManager.applyConfigFromSettings()
    return servers
  })

  ipcMain.handle('mcp:importFromFile', async (_event, filePath?: string) => {
    let path = filePath
    if (!path) {
      const result = await dialog.showOpenDialog(getWindow(), {
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (result.canceled || !result.filePaths[0]) return null
      path = result.filePaths[0]
    }

    const raw = readFileSync(path, 'utf-8')
    const imported = parseCursorMcpJson(JSON.parse(raw))
    const settings = sanitizeSettings(store.get('settings'))
    const merged = mergeMcpServerConfigs(settings.mcpServers ?? [], imported)
    return merged
  })

  ipcMain.handle('mcp:importDefaultCursor', () => {
    const defaultPath = getDefaultCursorMcpPath()
    if (!existsSync(defaultPath)) {
      throw new AppError(AppErrorCode.MCP_CURSOR_CONFIG_NOT_FOUND, { path: defaultPath })
    }
    const raw = readFileSync(defaultPath, 'utf-8')
    const imported = parseCursorMcpJson(JSON.parse(raw))

    const settings = sanitizeSettings(store.get('settings'))
    let merged = mergeMcpServerConfigs(settings.mcpServers ?? [], imported)

    const workspace = settings.workingDirectory
    if (workspace) {
      const workspacePath = getWorkspaceCursorMcpPath(workspace)
      if (existsSync(workspacePath)) {
        const workspaceRaw = readFileSync(workspacePath, 'utf-8')
        const workspaceImported = parseCursorMcpJson(JSON.parse(workspaceRaw))
        merged = mergeMcpServerConfigs(merged, workspaceImported)
      }
    }

    return merged
  })

  ipcMain.handle('mcp:testServer', (_event, config: McpServerConfig) => {
    return mcpManager.testServer(config)
  })

  ipcMain.handle('mcp:reconnect', async () => {
    if (agentService.isRunning || runQueue.hasActiveRuns()) {
      mcpManager.queueReconnectAfterRun()
      return mcpManager.getStatus()
    }
    await mcpManager.reconnectAll()
    return mcpManager.getStatus()
  })
}

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason)
  if (agentService.isRunning) agentService.abort()
  void runQueue.abortAll('shutdown')
})

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

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.toggleDevTools()
  })

  applyIndexSettings(settings)
  void runQueue.load()
  void mcpManager.initialize().catch((err) => {
    console.error('[MCP] Failed to initialize:', err)
  })
  scheduleStartupUpdateCheck(updateChecker, () => sanitizeSettings(store.get('settings')), (update) => {
    sendToRenderer('updates:available', update)
  })
  codebaseIndexer.onProgress((progress) => {
    sendToRenderer('index:progress', progress)
  })
  codebaseIndexer.onStatus((status) => {
    sendToRenderer('index:status', status)
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
  globalShortcut.unregisterAll()
  shutdownApp()
})
