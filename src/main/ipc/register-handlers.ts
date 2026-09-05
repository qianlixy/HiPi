import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { PiRuntimeManager } from '../runtime/pi-runtime'
import { AgentSessionManager } from '../sdk/agent-session-manager'
import { SessionScanner } from '../session/session-scanner'
import { SettingsStore } from '../store'
import path from 'path'

export const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export async function safeOpenExternal(rawUrl: string): Promise<boolean> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return false
  }
  try {
    const parsed = new URL(rawUrl)
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
      console.warn(`[Security] Blocked disallowed protocol: ${rawUrl}`)
      return false
    }
    await shell.openExternal(rawUrl)
    return true
  } catch {
    return false
  }
}

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  runtimeManager: PiRuntimeManager,
  sessionManager: AgentSessionManager,
  sessionScanner: SessionScanner,
  settingsStore: SettingsStore
) {
  // Listen to session manager events and forward to renderer
  sessionManager.onEvent(({ workspacePath, sessionId, event }) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('pi:event', {
        workspacePath,
        sessionId,
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
    const sessionId = path.basename(sessionPath, '.jsonl')
    for (const ws of settingsStore.getSettings().workspaces) {
      sessionManager.stopSession(ws.path, sessionId)
    }
    return sessionScanner.deleteSession(sessionPath)
  })

  ipcMain.handle('session:get-messages', async (_, sessionPath: string) => {
    return await sessionScanner.getSessionMessages(sessionPath)
  })

  // --- PI SDK Interaction ---
  ipcMain.handle(
    'pi:send-prompt',
    async (
      _,
      {
        workspacePath,
        sessionId,
        message,
        images
      }: { workspacePath: string; sessionId?: string; message: string; images?: string[] }
    ) => {
      return await sessionManager.prompt(workspacePath, message, images, sessionId)
    }
  )

  ipcMain.handle('pi:abort', async (_, args: string | { workspacePath: string; sessionId?: string }) => {
    const wsPath = typeof args === 'string' ? args : args.workspacePath
    const sId = typeof args === 'string' ? undefined : args.sessionId
    return await sessionManager.abort(wsPath, sId)
  })

  ipcMain.handle('pi:get-available-models', async (_, workspacePath: string) => {
    return await sessionManager.getAvailableModels(workspacePath)
  })

  ipcMain.handle(
    'pi:set-model',
    async (
      _,
      {
        workspacePath,
        sessionId,
        provider,
        modelId
      }: { workspacePath: string; sessionId?: string; provider: string; modelId: string }
    ) => {
      return await sessionManager.setModel(workspacePath, provider, modelId, sessionId)
    }
  )

  ipcMain.handle(
    'pi:get-available-thinking-levels',
    async (_, args: string | { workspacePath: string; sessionId?: string }) => {
      const wsPath = typeof args === 'string' ? args : args.workspacePath
      const sId = typeof args === 'string' ? undefined : args.sessionId
      return await sessionManager.getAvailableThinkingLevels(wsPath, sId)
    }
  )

  ipcMain.handle(
    'pi:set-thinking-level',
    async (
      _,
      { workspacePath, sessionId, level }: { workspacePath: string; sessionId?: string; level: string }
    ) => {
      return await sessionManager.setThinkingLevel(workspacePath, level, sessionId)
    }
  )

  ipcMain.handle('pi:get-state', async (_, args: string | { workspacePath: string; sessionId?: string }) => {
    const wsPath = typeof args === 'string' ? args : args.workspacePath
    const sId = typeof args === 'string' ? undefined : args.sessionId
    return await sessionManager.getState(wsPath, sId)
  })

  ipcMain.handle('pi:get-messages', async (_, args: string | { workspacePath: string; sessionId?: string }) => {
    const wsPath = typeof args === 'string' ? args : args.workspacePath
    const sId = typeof args === 'string' ? undefined : args.sessionId
    return await sessionManager.getMessages(wsPath, sId)
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

  ipcMain.handle(
    'pi:get-session-stats',
    async (_, args: string | { workspacePath: string; sessionId?: string }) => {
      const wsPath = typeof args === 'string' ? args : args.workspacePath
      const sId = typeof args === 'string' ? undefined : args.sessionId
      return await sessionManager.getSessionStats(wsPath, sId)
    }
  )

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

  // --- System & Shell Handlers ---
  ipcMain.handle('system:open-external', async (_, url: string) => {
    return safeOpenExternal(url)
  })
}
