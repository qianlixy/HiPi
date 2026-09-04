import { contextBridge, ipcRenderer } from 'electron'
import {
  Workspace,
  SessionSummary,
  AppSettings,
  PiRuntimeStatus,
  ChatMessage,
  PiEventPayload,
  PiStderrPayload,
  PiExitPayload
} from '../main/types'

const hipiApi = {
  workspace: {
    openDialog: (): Promise<{ path: string; name: string } | null> =>
      ipcRenderer.invoke('workspace:open-dialog'),
    list: (): Promise<Workspace[]> => ipcRenderer.invoke('workspace:list'),
    add: (ws: { path: string; name?: string }): Promise<Workspace[]> =>
      ipcRenderer.invoke('workspace:add', ws),
    remove: (path: string): Promise<Workspace[]> => ipcRenderer.invoke('workspace:remove', path),
    startClient: (path: string): Promise<boolean> =>
      ipcRenderer.invoke('workspace:start-client', path)
  },

  session: {
    listAll: (): Promise<SessionSummary[]> => ipcRenderer.invoke('session:list-all'),
    listWorkspace: (path: string): Promise<SessionSummary[]> =>
      ipcRenderer.invoke('session:list-workspace', path),
    getMessages: (sessionPath: string): Promise<ChatMessage[]> =>
      ipcRenderer.invoke('session:get-messages', sessionPath),
    delete: (sessionPath: string): Promise<boolean> =>
      ipcRenderer.invoke('session:delete', sessionPath)
  },

  pi: {
    sendPrompt: (params: {
      workspacePath: string
      sessionId?: string
      message: string
      images?: string[]
    }): Promise<any> => ipcRenderer.invoke('pi:send-prompt', params),

    abort: (params: string | { workspacePath: string; sessionId?: string }): Promise<boolean> =>
      ipcRenderer.invoke('pi:abort', typeof params === 'string' ? { workspacePath: params } : params),

    getAvailableModels: (workspacePath: string): Promise<any> =>
      ipcRenderer.invoke('pi:get-available-models', workspacePath),

    setModel: (params: {
      workspacePath: string
      sessionId?: string
      provider: string
      modelId: string
    }): Promise<any> => ipcRenderer.invoke('pi:set-model', params),

    getAvailableThinkingLevels: (
      params: string | { workspacePath: string; sessionId?: string }
    ): Promise<{ levels: string[] }> =>
      ipcRenderer.invoke(
        'pi:get-available-thinking-levels',
        typeof params === 'string' ? { workspacePath: params } : params
      ),

    setThinkingLevel: (params: {
      workspacePath: string
      sessionId?: string
      level: string
    }): Promise<any> => ipcRenderer.invoke('pi:set-thinking-level', params),

    getState: (params: string | { workspacePath: string; sessionId?: string }): Promise<any> =>
      ipcRenderer.invoke('pi:get-state', typeof params === 'string' ? { workspacePath: params } : params),

    getMessages: (params: string | { workspacePath: string; sessionId?: string }): Promise<any> =>
      ipcRenderer.invoke('pi:get-messages', typeof params === 'string' ? { workspacePath: params } : params),

    newSession: (workspacePath: string): Promise<any> =>
      ipcRenderer.invoke('pi:new-session', workspacePath),

    switchSession: (params: {
      workspacePath: string
      sessionPath: string
    }): Promise<any> => ipcRenderer.invoke('pi:switch-session', params),

    getSessionStats: (params: string | { workspacePath: string; sessionId?: string }): Promise<any> =>
      ipcRenderer.invoke(
        'pi:get-session-stats',
        typeof params === 'string' ? { workspacePath: params } : params
      ),

    getRuntimeStatus: (): Promise<PiRuntimeStatus> =>
      ipcRenderer.invoke('pi:runtime-status'),

    upgradeRuntime: (): Promise<{ success: boolean; version?: string; error?: string }> =>
      ipcRenderer.invoke('pi:runtime-upgrade'),

    onEvent: (callback: (data: PiEventPayload) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('pi:event', handler)
      return () => {
        ipcRenderer.removeListener('pi:event', handler)
      }
    },

    onStderr: (callback: (data: PiStderrPayload) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('pi:stderr', handler)
      return () => {
        ipcRenderer.removeListener('pi:stderr', handler)
      }
    },

    onExit: (callback: (data: PiExitPayload) => void) => {
      const handler = (_: any, data: any) => callback(data)
      ipcRenderer.on('pi:exit', handler)
      return () => {
        ipcRenderer.removeListener('pi:exit', handler)
      }
    }
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    save: (newSettings: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:save', newSettings)
  }
}

export type HipiApi = typeof hipiApi

contextBridge.exposeInMainWorld('hipiApi', hipiApi)
