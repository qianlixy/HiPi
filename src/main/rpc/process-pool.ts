import { BrowserWindow } from 'electron'
import { PiRpcClient } from './rpc-client'
import { PiRuntimeManager } from '../runtime/pi-runtime'

export class WorkspaceProcessPool {
  private pool = new Map<string, PiRpcClient>()
  private runtimeManager: PiRuntimeManager
  private currentEnv: NodeJS.ProcessEnv = {}

  constructor(runtimeManager: PiRuntimeManager) {
    this.runtimeManager = runtimeManager
  }

  public setEnv(env: NodeJS.ProcessEnv) {
    this.currentEnv = env
  }

  public async getOrCreateClient(
    workspacePath: string,
    mainWindow?: BrowserWindow | null
  ): Promise<PiRpcClient> {
    const normalized = workspacePath.trim()
    let client = this.pool.get(normalized)
    if (client && client.getStatus()) {
      return client
    }

    const executablePath = this.runtimeManager.getExecutablePath()
    client = new PiRpcClient(normalized, executablePath, this.currentEnv)

    if (mainWindow && !mainWindow.isDestroyed()) {
      // Forward events to renderer
      client.on('event', (event) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pi:event', {
            workspacePath: normalized,
            event
          })
        }
      })

      client.on('stderr', (text) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pi:stderr', {
            workspacePath: normalized,
            text
          })
        }
      })

      client.on('exit', ({ code, signal }) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('pi:exit', {
            workspacePath: normalized,
            code,
            signal
          })
        }
      })
    }

    await client.start()
    this.pool.set(normalized, client)
    return client
  }

  public getClient(workspacePath: string): PiRpcClient | undefined {
    return this.pool.get(workspacePath.trim())
  }

  public stopClient(workspacePath: string): void {
    const client = this.pool.get(workspacePath.trim())
    if (client) {
      client.stop()
      this.pool.delete(workspacePath.trim())
    }
  }

  public stopAll(): void {
    for (const [key, client] of this.pool.entries()) {
      client.stop()
    }
    this.pool.clear()
  }
}
