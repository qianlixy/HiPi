import { ipcMain, dialog, BrowserWindow } from 'electron'
import { PiRuntimeManager } from '../runtime/pi-runtime'
import { AgentSessionManager } from '../sdk/agent-session-manager'
import { SessionScanner } from '../session/session-scanner'
import { SettingsStore } from '../store'
import path from 'path'

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  runtimeManager: PiRuntimeManager,
  sessionManager: AgentSessionManager,
  sessionScanner: SessionScanner,
  settingsStore: SettingsStore
) {
  // Listen to session manager events and forward to renderer
  sessionManager.onEvent(({ workspacePath, event }) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('pi:event', {
        workspacePath,
        event
      })
    }
  })

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
    sessionManager.stopWorkspace(workspacePath)
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
    await sessionManager.getOrCreateEntry(workspacePath)
    return true
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

  // --- PI SDK Interaction ---
  ipcMain.handle(
    'pi:send-prompt',
    async (_, { workspacePath, message, images }: { workspacePath: string; message: string; images?: string[] }) => {
      return await sessionManager.prompt(workspacePath, message, images)
    }
  )

  ipcMain.handle('pi:abort', async (_, workspacePath: string) => {
    return await sessionManager.abort(workspacePath)
  })

  ipcMain.handle('pi:get-available-models', async (_, workspacePath: string) => {
    return await sessionManager.getAvailableModels(workspacePath)
  })

  ipcMain.handle(
    'pi:set-model',
    async (_, { workspacePath, provider, modelId }: { workspacePath: string; provider: string; modelId: string }) => {
      return await sessionManager.setModel(workspacePath, provider, modelId)
    }
  )

  ipcMain.handle('pi:get-available-thinking-levels', async (_, workspacePath: string) => {
    return await sessionManager.getAvailableThinkingLevels(workspacePath)
  })

  ipcMain.handle(
    'pi:set-thinking-level',
    async (_, { workspacePath, level }: { workspacePath: string; level: string }) => {
      return await sessionManager.setThinkingLevel(workspacePath, level)
    }
  )

  ipcMain.handle('pi:get-state', async (_, workspacePath: string) => {
    return await sessionManager.getState(workspacePath)
  })

  ipcMain.handle('pi:get-messages', async (_, workspacePath: string) => {
    return await sessionManager.getMessages(workspacePath)
  })

  ipcMain.handle('pi:new-session', async (_, workspacePath: string) => {
    return await sessionManager.newSession(workspacePath)
  })

  ipcMain.handle(
    'pi:switch-session',
    async (_, { workspacePath, sessionPath }: { workspacePath: string; sessionPath: string }) => {
      return await sessionManager.switchSession(workspacePath, sessionPath)
    }
  )

  ipcMain.handle('pi:get-session-stats', async (_, workspacePath: string) => {
    return await sessionManager.getSessionStats(workspacePath)
  })

  // --- PI Runtime Status & Version ---
  ipcMain.handle('pi:runtime-status', async () => {
    return await runtimeManager.getStatus()
  })

  ipcMain.handle('pi:runtime-upgrade', async () => {
    return await runtimeManager.installOrUpdate()
  })

  // --- Settings ---
  ipcMain.handle('settings:get', async () => {
    return settingsStore.getSettings()
  })

  ipcMain.handle('settings:save', async (_, newSettings) => {
    const updated = settingsStore.saveSettings(newSettings)
    await sessionManager.syncSettings(updated)
    return updated
  })
}
