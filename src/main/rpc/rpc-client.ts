import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

export interface RpcResponse<T = any> {
  id?: string
  type: 'response'
  command: string
  success: boolean
  data?: T
  error?: string
}

export class PiRpcClient extends EventEmitter {
  public readonly workspacePath: string
  private executablePath: string
  private env: NodeJS.ProcessEnv
  private child: ChildProcess | null = null
  private stdoutBuffer = ''
  private nextRequestId = 1
  private pendingRequests = new Map<
    string,
    { resolve: (data: any) => void; reject: (err: Error) => void }
  >()
  private isRunning = false

  constructor(workspacePath: string, executablePath: string, env: NodeJS.ProcessEnv) {
    super()
    this.workspacePath = workspacePath
    this.executablePath = executablePath
    this.env = env
  }

  public async start(): Promise<void> {
    if (this.child) return

    return new Promise((resolve, reject) => {
      try {
        this.child = spawn(this.executablePath, ['--mode', 'rpc'], {
          cwd: this.workspacePath,
          env: {
            ...process.env,
            ...this.env
          },
          stdio: ['pipe', 'pipe', 'pipe']
        })

        this.child.stdout?.on('data', (chunk: Buffer) => {
          this.handleStdout(chunk.toString('utf8'))
        })

        this.child.stderr?.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf8')
          this.emit('stderr', text)
        })

        this.child.on('error', (err) => {
          this.isRunning = false
          this.emit('error', err)
          reject(err)
        })

        this.child.on('exit', (code, signal) => {
          this.isRunning = false
          this.child = null
          this.emit('exit', { code, signal })
        })

        this.isRunning = true
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  }

  private handleStdout(text: string) {
    this.stdoutBuffer += text
    const lines = this.stdoutBuffer.split('\n')
    // Keep incomplete tail
    this.stdoutBuffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const msg = JSON.parse(trimmed)
        if (msg.type === 'response') {
          const reqId = msg.id
          if (reqId && this.pendingRequests.has(reqId)) {
            const { resolve, reject } = this.pendingRequests.get(reqId)!
            this.pendingRequests.delete(reqId)
            if (msg.success) {
              resolve(msg.data)
            } else {
              reject(new Error(msg.error || 'Command failed'))
            }
          }
          this.emit('response', msg)
        } else {
          // Streaming or Agent lifecycle event
          this.emit('event', msg)
        }
      } catch (e) {
        this.emit('parse_error', { line: trimmed, error: e })
      }
    }
  }

  public async sendCommand<T = any>(type: string, payload: Record<string, any> = {}): Promise<T> {
    if (!this.child || !this.child.stdin) {
      throw new Error(`RPC client not running for workspace: ${this.workspacePath}`)
    }

    const id = `req-${this.nextRequestId++}`
    const commandObj = { id, type, ...payload }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })

      // Set timeout of 30 seconds for standard commands (except long-running prompt which emits events)
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id) && type !== 'prompt') {
          this.pendingRequests.delete(id)
          reject(new Error(`Command ${type} timed out`))
        }
      }, 30000)

      this.child!.stdin!.write(JSON.stringify(commandObj) + '\n', 'utf8', (err) => {
        if (err) {
          clearTimeout(timeout)
          this.pendingRequests.delete(id)
          reject(err)
        }
      })
    })
  }

  // Common RPC convenience methods
  public async prompt(message: string, images?: string[]): Promise<any> {
    return this.sendCommand('prompt', { message, ...(images ? { images } : {}) })
  }

  public async abort(): Promise<void> {
    if (!this.child || !this.child.stdin) return
    // Write abort immediately
    this.child.stdin.write(JSON.stringify({ type: 'abort' }) + '\n', 'utf8')
  }

  public async getAvailableModels(): Promise<any> {
    return this.sendCommand('get_available_models')
  }

  public async setModel(provider: string, modelId: string): Promise<any> {
    return this.sendCommand('set_model', { provider, modelId })
  }

  public async getAvailableThinkingLevels(): Promise<{ levels: string[] }> {
    return this.sendCommand('get_available_thinking_levels')
  }

  public async setThinkingLevel(level: string): Promise<any> {
    return this.sendCommand('set_thinking_level', { level })
  }

  public async getState(): Promise<any> {
    return this.sendCommand('get_state')
  }

  public async getMessages(): Promise<any> {
    return this.sendCommand('get_messages')
  }

  public async newSession(): Promise<any> {
    return this.sendCommand('new_session')
  }

  public async switchSession(sessionPath: string): Promise<any> {
    return this.sendCommand('switch_session', { sessionPath })
  }

  public async getSessionStats(): Promise<any> {
    return this.sendCommand('get_session_stats')
  }

  public stop(): void {
    if (this.child) {
      try {
        this.child.kill('SIGTERM')
      } catch {}
      this.child = null
    }
    this.isRunning = false
    this.pendingRequests.clear()
  }

  public getStatus(): boolean {
    return this.isRunning
  }
}
