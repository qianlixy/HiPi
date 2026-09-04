import { ipcMain, dialog, BrowserWindow } from 'electron'
import { PiRuntimeManager } from '../runtime/pi-runtime'
import { WorkspaceProcessPool } from '../rpc/process-pool'
import { SessionScanner } from '../session/session-scanner'
import { SettingsStore } from '../store'
import path from 'path'

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  runtimeManager: PiRuntimeManager,
  processPool: WorkspaceProcessPool,
  sessionScanner: SessionScanner,
  settingsStore: SettingsStore
) {
  // --- Workspace Dialog & Management ---
  ipcMain.handle('workspace:open-dialog', async () => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    const folderPath = result.filePaths[0]
    const folderName = path.basename(folderPath)
    return { path: folderPath, name: folderName }
  })

  ipcMain.handle('workspace:list', async () => {
    return settingsStore.getSettings().workspaces
  })

  ipcMain.handle('workspace:add', async (_, workspace: { path: string; name?: string }) => {
    const settings = settingsStore.getSettings()
    const name = workspace.name || path.basename(workspace.path)
    const exists = settings.workspaces.some((w) => w.path === workspace.path)
    if (!exists) {
      const updated = [
        ...settings.workspaces,
        { id: Buffer.from(workspace.path).toString('base64url'), path: workspace.path, name }
      ]
      settingsStore.saveSettings({ workspaces: updated, activeWorkspacePath: workspace.path })
      return updated
    }
    return settings.workspaces
  })

  ipcMain.handle('workspace:remove', async (_, workspacePath: string) => {
    processPool.stopClient(workspacePath)
    const settings = settingsStore.getSettings()
    const updated = settings.workspaces.filter((w) => w.path !== workspacePath)
    const nextActive =
      settings.activeWorkspacePath === workspacePath
        ? updated[0]?.path || undefined
        : settings.activeWorkspacePath
    settingsStore.saveSettings({ workspaces: updated, activeWorkspacePath: nextActive })
    return updated
  })

  ipcMain.handle('workspace:start-client', async (_, workspacePath: string) => {
    const win = getMainWindow()
    const client = await processPool.getOrCreateClient(workspacePath, win)
    return client.getStatus()
  })

  // --- Session Management ---
  ipcMain.handle('session:list-all', async () => {
    return await sessionScanner.scanAllSessions()
  })

  ipcMain.handle('session:list-workspace', async (_, workspacePath: string) => {
    return await sessionScanner.scanWorkspaceSessions(workspacePath)
  })

  ipcMain.handle('session:delete', async (_, sessionPath: string) => {
    return sessionScanner.deleteSession(sessionPath)
  })

  ipcMain.handle('session:get-messages', async (_, sessionPath: string) => {
    return await sessionScanner.getSessionMessages(sessionPath)
  })

  // --- PI RPC Interaction ---
  ipcMain.handle(
    'pi:send-prompt',
    async (_, { workspacePath, message, images }: { workspacePath: string; message: string; images?: string[] }) => {
      const win = getMainWindow()
      const client = await processPool.getOrCreateClient(workspacePath, win)
      return await client.prompt(message, images)
    }
  )

  ipcMain.handle('pi:abort', async (_, workspacePath: string) => {
    const client = processPool.getClient(workspacePath)
    if (client) {
      await client.abort()
      return true
    }
    return false
  })

  ipcMain.handle('pi:get-available-models', async (_, workspacePath: string) => {
    const win = getMainWindow()
    const client = await processPool.getOrCreateClient(workspacePath, win)
    return await client.getAvailableModels()
  })

  ipcMain.handle(
    'pi:set-model',
    async (_, { workspacePath, provider, modelId }: { workspacePath: string; provider: string; modelId: string }) => {
      const win = getMainWindow()
      const client = await processPool.getOrCreateClient(workspacePath, win)
      return await client.setModel(provider, modelId)
    }
  )

  ipcMain.handle('pi:get-available-thinking-levels', async (_, workspacePath: string) => {
    const win = getMainWindow()
    const client = await processPool.getOrCreateClient(workspacePath, win)
    return await client.getAvailableThinkingLevels()
  })

  ipcMain.handle(
    'pi:set-thinking-level',
    async (_, { workspacePath, level }: { workspacePath: string; level: string }) => {
      const win = getMainWindow()
      const client = await processPool.getOrCreateClient(workspacePath, win)
      return await client.setThinkingLevel(level)
    }
  )

  ipcMain.handle('pi:get-state', async (_, workspacePath: string) => {
    const win = getMainWindow()
    const client = await processPool.getOrCreateClient(workspacePath, win)
    return await client.getState()
  })

  ipcMain.handle('pi:get-messages', async (_, workspacePath: string) => {
    const win = getMainWindow()
    const client = await processPool.getOrCreateClient(workspacePath, win)
    return await client.getMessages()
  })

  ipcMain.handle('pi:new-session', async (_, workspacePath: string) => {
    const win = getMainWindow()
    const client = await processPool.getOrCreateClient(workspacePath, win)
    return await client.newSession()
  })

  ipcMain.handle(
    'pi:switch-session',
    async (_, { workspacePath, sessionPath }: { workspacePath: string; sessionPath: string }) => {
      const win = getMainWindow()
      const client = await processPool.getOrCreateClient(workspacePath, win)
      return await client.switchSession(sessionPath)
    }
  )

  ipcMain.handle('pi:get-session-stats', async (_, workspacePath: string) => {
    const win = getMainWindow()
    const client = await processPool.getOrCreateClient(workspacePath, win)
    return await client.getSessionStats()
  })

  // --- PI Runtime Sandbox & Version Upgrade ---
  ipcMain.handle('pi:runtime-status', async () => {
    return await runtimeManager.getStatus()
  })

  ipcMain.handle('pi:runtime-upgrade', async () => {
    const res = await runtimeManager.installOrUpdate()
    if (res.success) {
      // Refresh process pool executable path if needed
      processPool.stopAll()
    }
    return res
  })

  // --- Settings ---
  ipcMain.handle('settings:get', async () => {
    return settingsStore.getSettings()
  })

  ipcMain.handle('settings:save', async (_, newSettings) => {
    const updated = settingsStore.saveSettings(newSettings)
    processPool.setEnv(settingsStore.getEnv())
    return updated
  })
}
