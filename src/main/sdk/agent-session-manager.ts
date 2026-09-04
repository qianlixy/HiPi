import type {
  AgentSessionRuntime,
  ModelRuntime,
  SessionManager
} from '@earendil-works/pi-coding-agent'
import { AppSettings, Model } from '../types'
import { AgentSessionState, IAgentSessionService } from './types'
import { adaptAgentSessionEvent } from './event-adapter'
import { getPiSdk } from './pi-sdk'

export interface AgentSessionManagerOptions {
  modelRuntime?: ModelRuntime
  sessionManagerFactory?: (cwd: string) => SessionManager
  maxEntries?: number
}

interface WorkspaceRuntimeEntry {
  workspacePath: string
  runtime: AgentSessionRuntime
  unsubscribe: () => void
  lastActiveAt: number
  isPrompting?: boolean
}

export class AgentSessionManager implements IAgentSessionService {
  private modelRuntime: ModelRuntime | null = null
  private entries = new Map<string, WorkspaceRuntimeEntry>()
  private inFlightCreations = new Map<string, Promise<WorkspaceRuntimeEntry>>()
  private eventListeners: Array<(data: { workspacePath: string; event: any }) => void> = []
  private sessionManagerFactory?: (cwd: string) => SessionManager
  private maxEntries: number

  constructor(options?: AgentSessionManagerOptions) {
    if (options?.modelRuntime) {
      this.modelRuntime = options.modelRuntime
    }
    this.sessionManagerFactory = options?.sessionManagerFactory
    this.maxEntries = options?.maxEntries && options.maxEntries > 0 ? options.maxEntries : 10
  }

  public async ensureModelRuntime(): Promise<ModelRuntime> {
    if (!this.modelRuntime) {
      const sdk = await getPiSdk()
      this.modelRuntime = await sdk.ModelRuntime.create()
    }
    return this.modelRuntime
  }

  private async createEntry(workspacePath: string): Promise<WorkspaceRuntimeEntry> {
    const normalized = workspacePath.trim()
    const sdk = await getPiSdk()
    const modelRuntime = await this.ensureModelRuntime()

    const createRuntime = async ({ cwd, sessionManager, sessionStartEvent }: any) => {
      const services = await sdk.createAgentSessionServices({
        cwd,
        agentDir: sdk.getAgentDir(),
        modelRuntime
      })
      return {
        ...(await sdk.createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
        services,
        diagnostics: services.diagnostics
      }
    }

    const sessionManager = this.sessionManagerFactory
      ? this.sessionManagerFactory(normalized)
      : sdk.SessionManager.create(normalized)

    const runtime = await sdk.createAgentSessionRuntime(createRuntime, {
      cwd: normalized,
      agentDir: sdk.getAgentDir(),
      sessionManager
    })

    let currentUnsubscribe: (() => void) | null = null

    const bindSubscription = () => {
      if (currentUnsubscribe) {
        currentUnsubscribe()
      }
      currentUnsubscribe = runtime.session.subscribe((event) => {
        const adapted = adaptAgentSessionEvent(event)
        this.emitEvent(normalized, adapted)
      })
    }

    runtime.setRebindSession(async () => {
      bindSubscription()
    })

    bindSubscription()

    const entry: WorkspaceRuntimeEntry = {
      workspacePath: normalized,
      runtime,
      unsubscribe: () => {
        if (currentUnsubscribe) {
          currentUnsubscribe()
          currentUnsubscribe = null
        }
      },
      lastActiveAt: Date.now()
    }

    return entry
  }

  public async getOrCreateEntry(workspacePath: string): Promise<WorkspaceRuntimeEntry> {
    const normalized = workspacePath.trim()
    const existing = this.entries.get(normalized)
    if (existing) {
      existing.lastActiveAt = Date.now()
      return existing
    }

    const inFlight = this.inFlightCreations.get(normalized)
    if (inFlight) {
      return await inFlight
    }

    const creationPromise = this.createEntry(normalized)
      .then((entry) => {
        this.pruneEntriesIfNecessary()
        this.entries.set(normalized, entry)
        this.inFlightCreations.delete(normalized)
        return entry
      })
      .catch((err) => {
        this.inFlightCreations.delete(normalized)
        throw err
      })

    this.inFlightCreations.set(normalized, creationPromise)
    return await creationPromise
  }

  private pruneEntriesIfNecessary(): void {
    if (this.entries.size < this.maxEntries) return

    // Find the least recently active workspace entry that is not actively streaming/prompting
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.entries) {
      if (entry.isPrompting || entry.runtime.session.isStreaming) continue
      if (entry.lastActiveAt < oldestTime) {
        oldestTime = entry.lastActiveAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.stopWorkspace(oldestKey)
    }
  }

  private emitEvent(workspacePath: string, event: any) {
    for (const listener of this.eventListeners) {
      try {
        listener({ workspacePath, event })
      } catch (err) {
        console.error('Error in agent session event listener:', err)
      }
    }
  }

  public onEvent(callback: (data: { workspacePath: string; event: any }) => void): () => void {
    this.eventListeners.push(callback)
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== callback)
    }
  }

  public async prompt(workspacePath: string, message: string, images?: string[]): Promise<void> {
    const entry = await this.getOrCreateEntry(workspacePath)
    entry.lastActiveAt = Date.now()

    let imageContents: any[] | undefined
    if (images && images.length > 0) {
      imageContents = images.map((img) => {
        if (img.startsWith('data:')) {
          const matches = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
          if (matches) {
            return {
              type: 'image',
              source: {
                type: 'base64',
                mediaType: matches[1],
                data: matches[2]
              }
            }
          }
        }
        return {
          type: 'image',
          source: {
            type: 'base64',
            mediaType: 'image/png',
            data: img
          }
        }
      })
    }

    entry.isPrompting = true
    return new Promise<void>((resolve, reject) => {
      let settled = false

      const finish = () => {
        entry.isPrompting = false
      }

      entry.runtime.session
        .prompt(message, {
          images: imageContents,
          streamingBehavior: entry.runtime.session.isStreaming ? 'followUp' : undefined,
          preflightResult: (didSucceed) => {
            if (didSucceed && !settled) {
              settled = true
              resolve()
            }
          }
        })
        .then(() => {
          finish()
          if (!settled) {
            settled = true
            resolve()
          }
        })
        .catch((err) => {
          finish()
          if (!settled) {
            settled = true
            reject(err)
          }
        })
    })
  }

  public async abort(workspacePath: string): Promise<boolean> {
    const entry = this.entries.get(workspacePath.trim())
    if (entry) {
      await entry.runtime.session.abort()
      return true
    }
    return false
  }

  public async setModel(workspacePath: string, provider: string, modelId: string): Promise<void> {
    const entry = await this.getOrCreateEntry(workspacePath)
    const models = entry.runtime.session.modelRuntime.getAvailableSnapshot()
    const target = models.find((m: any) => m.provider === provider && m.id === modelId)
    if (!target) {
      throw new Error(`Model not found: ${provider}/${modelId}`)
    }
    await entry.runtime.session.setModel(target)
  }

  public async setThinkingLevel(workspacePath: string, level: string): Promise<void> {
    const entry = await this.getOrCreateEntry(workspacePath)
    entry.runtime.session.setThinkingLevel(level as any)
  }

  public async getAvailableModels(_workspacePath?: string): Promise<{ models: Model[] }> {
    const modelRuntime = await this.ensureModelRuntime()
    const rawModels = modelRuntime.getAvailableSnapshot()
    const models: Model[] = rawModels.map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      provider: m.provider || 'default',
      description: m.description,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      supportsThinking: !!m.reasoning || (Array.isArray(m.thinkingLevels) && m.thinkingLevels.length > 0)
    }))
    return { models }
  }

  public async getAvailableThinkingLevels(workspacePath: string): Promise<{ levels: string[] }> {
    const entry = await this.getOrCreateEntry(workspacePath)
    const levels = entry.runtime.session.getAvailableThinkingLevels()
    return { levels }
  }

  public async getState(workspacePath: string): Promise<AgentSessionState> {
    const entry = await this.getOrCreateEntry(workspacePath)
    const session = entry.runtime.session
    return {
      model: session.model
        ? {
            id: session.model.id,
            name: session.model.name,
            provider: session.model.provider
          }
        : undefined,
      thinkingLevel: session.thinkingLevel,
      isStreaming: session.isStreaming,
      sessionId: session.sessionId,
      sessionFile: session.sessionFile,
      sessionName: session.sessionName,
      messageCount: session.messages.length
    }
  }

  public async getMessages(workspacePath: string): Promise<{ messages: any[] }> {
    const entry = await this.getOrCreateEntry(workspacePath)
    return { messages: entry.runtime.session.messages }
  }

  public async newSession(workspacePath: string): Promise<any> {
    const entry = await this.getOrCreateEntry(workspacePath)
    return await entry.runtime.newSession()
  }

  public async switchSession(workspacePath: string, sessionPath: string): Promise<any> {
    const entry = await this.getOrCreateEntry(workspacePath)
    return await entry.runtime.switchSession(sessionPath)
  }

  public async getSessionStats(workspacePath: string): Promise<any> {
    const entry = await this.getOrCreateEntry(workspacePath)
    return entry.runtime.session.getSessionStats()
  }

  public async syncSettings(settings: AppSettings): Promise<void> {
    const modelRuntime = await this.ensureModelRuntime()
    const { apiKeys } = settings

    if (apiKeys) {
      if (apiKeys.anthropic !== undefined) {
        if (apiKeys.anthropic) await modelRuntime.setRuntimeApiKey('anthropic', apiKeys.anthropic)
        else await modelRuntime.removeRuntimeApiKey('anthropic')
      }
      if (apiKeys.openai !== undefined) {
        if (apiKeys.openai) await modelRuntime.setRuntimeApiKey('openai', apiKeys.openai)
        else await modelRuntime.removeRuntimeApiKey('openai')
      }
      if (apiKeys.google !== undefined) {
        if (apiKeys.google) await modelRuntime.setRuntimeApiKey('google', apiKeys.google)
        else await modelRuntime.removeRuntimeApiKey('google')
      }
      if (apiKeys.deepseek !== undefined) {
        if (apiKeys.deepseek) await modelRuntime.setRuntimeApiKey('deepseek', apiKeys.deepseek)
        else await modelRuntime.removeRuntimeApiKey('deepseek')
      }
      if (apiKeys.openrouter !== undefined) {
        if (apiKeys.openrouter) await modelRuntime.setRuntimeApiKey('openrouter', apiKeys.openrouter)
        else await modelRuntime.removeRuntimeApiKey('openrouter')
      }
    }

    // Refresh providers to pick up models.json changes and update snapshot
    await modelRuntime.refresh({ allowNetwork: false })
  }

  public stopWorkspace(workspacePath: string): void {
    const normalized = workspacePath.trim()
    const entry = this.entries.get(normalized)
    if (entry) {
      try {
        entry.unsubscribe()
        entry.runtime.dispose()
      } catch {}
      this.entries.delete(normalized)
    }
  }

  public stopAll(): void {
    for (const [, entry] of this.entries) {
      try {
        entry.unsubscribe()
        entry.runtime.dispose()
      } catch {}
    }
    this.entries.clear()
  }
}
