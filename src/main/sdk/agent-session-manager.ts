import path from 'path'
import type {
  AgentSessionRuntime,
  ModelRuntime,
  SessionManager
} from '@earendil-works/pi-coding-agent'
import { AppSettings, Model, PiEventPayload } from '../types'
import { AgentSessionState, IAgentSessionService } from './types'
import { adaptAgentSessionEvent } from './event-adapter'
import { getPiSdk } from './pi-sdk'

export interface AgentSessionManagerOptions {
  modelRuntime?: ModelRuntime
  sessionManagerFactory?: (cwd: string, sessionPath?: string) => SessionManager
  maxEntries?: number
}

export interface SessionRuntimeEntry {
  workspacePath: string
  sessionId: string
  sessionPath?: string
  runtime: AgentSessionRuntime
  unsubscribe: () => void
  lastActiveAt: number
  isPrompting?: boolean
}

export class AgentSessionManager implements IAgentSessionService {
  private modelRuntime: ModelRuntime | null = null
  private entries = new Map<string, SessionRuntimeEntry>()
  private inFlightCreations = new Map<string, Promise<SessionRuntimeEntry>>()
  private activeSessionIdByWorkspace = new Map<string, string>()
  private eventListeners: Array<(data: PiEventPayload) => void> = []
  private sessionManagerFactory?: (cwd: string, sessionPath?: string) => SessionManager
  private maxEntries: number

  constructor(options?: AgentSessionManagerOptions) {
    if (options?.modelRuntime) {
      this.modelRuntime = options.modelRuntime
    }
    this.sessionManagerFactory = options?.sessionManagerFactory
    this.maxEntries = options?.maxEntries && options.maxEntries > 0 ? options.maxEntries : 10
  }

  private makeKey(workspacePath: string, sessionId: string): string {
    return `${workspacePath.trim()}::${sessionId}`
  }

  public async ensureModelRuntime(): Promise<ModelRuntime> {
    if (!this.modelRuntime) {
      const sdk = await getPiSdk()
      this.modelRuntime = await sdk.ModelRuntime.create()
    }
    return this.modelRuntime
  }

  private async createEntry(
    workspacePath: string,
    sessionId?: string,
    sessionPath?: string
  ): Promise<SessionRuntimeEntry> {
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
      ? this.sessionManagerFactory(normalized, sessionPath)
      : sessionPath
        ? sdk.SessionManager.open(sessionPath, normalized)
        : sdk.SessionManager.create(normalized)

    const runtime = await sdk.createAgentSessionRuntime(createRuntime, {
      cwd: normalized,
      agentDir: sdk.getAgentDir(),
      sessionManager
    })

    const actualSessionId =
      runtime.session.sessionId ||
      sessionId ||
      (sessionManager as any).getSessionId?.() ||
      `sess-${Date.now()}`

    let currentUnsubscribe: (() => void) | null = null

    const bindSubscription = () => {
      if (currentUnsubscribe) {
        currentUnsubscribe()
      }
      currentUnsubscribe = runtime.session.subscribe((event) => {
        const adapted = adaptAgentSessionEvent(event)
        this.emitEvent({
          workspacePath: normalized,
          sessionId: runtime.session.sessionId || actualSessionId,
          event: adapted
        })
      })
    }

    runtime.setRebindSession(async () => {
      bindSubscription()
    })

    bindSubscription()

    const entry: SessionRuntimeEntry = {
      workspacePath: normalized,
      sessionId: actualSessionId,
      sessionPath: sessionPath || runtime.session.sessionFile,
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

  public async getOrCreateEntry(
    workspacePath: string,
    sessionId?: string,
    sessionPath?: string
  ): Promise<SessionRuntimeEntry> {
    const normalized = workspacePath.trim()

    // 1. If explicit sessionId is requested
    if (sessionId) {
      const key = this.makeKey(normalized, sessionId)
      const existing = this.entries.get(key)
      if (existing) {
        existing.lastActiveAt = Date.now()
        this.activeSessionIdByWorkspace.set(normalized, existing.sessionId)
        return existing
      }

      const inFlight = this.inFlightCreations.get(key)
      if (inFlight) {
        return await inFlight
      }

      const creationPromise = this.createEntry(normalized, sessionId, sessionPath)
        .then((entry) => {
          this.pruneEntriesIfNecessary()
          const actualKey = this.makeKey(normalized, entry.sessionId)
          this.entries.set(actualKey, entry)
          if (actualKey !== key) {
            this.entries.set(key, entry)
          }
          this.activeSessionIdByWorkspace.set(normalized, entry.sessionId)
          this.inFlightCreations.delete(key)
          return entry
        })
        .catch((err) => {
          this.inFlightCreations.delete(key)
          throw err
        })

      this.inFlightCreations.set(key, creationPromise)
      return await creationPromise
    }

    // 2. If explicit sessionPath is requested
    if (sessionPath) {
      for (const entry of this.entries.values()) {
        if (
          entry.workspacePath === normalized &&
          (entry.sessionPath === sessionPath || entry.runtime.session.sessionFile === sessionPath)
        ) {
          entry.lastActiveAt = Date.now()
          this.activeSessionIdByWorkspace.set(normalized, entry.sessionId)
          return entry
        }
      }

      const pathKey = `${normalized}::path::${sessionPath}`
      const inFlight = this.inFlightCreations.get(pathKey)
      if (inFlight) {
        return await inFlight
      }

      const creationPromise = this.createEntry(normalized, undefined, sessionPath)
        .then((entry) => {
          this.pruneEntriesIfNecessary()
          const actualKey = this.makeKey(normalized, entry.sessionId)
          this.entries.set(actualKey, entry)
          this.activeSessionIdByWorkspace.set(normalized, entry.sessionId)
          this.inFlightCreations.delete(pathKey)
          return entry
        })
        .catch((err) => {
          this.inFlightCreations.delete(pathKey)
          throw err
        })

      this.inFlightCreations.set(pathKey, creationPromise)
      return await creationPromise
    }

    // 3. If no sessionId and no sessionPath, check workspace's active session
    const activeId = this.activeSessionIdByWorkspace.get(normalized)
    if (activeId) {
      const existing = this.entries.get(this.makeKey(normalized, activeId))
      if (existing) {
        existing.lastActiveAt = Date.now()
        return existing
      }
    }

    // 4. Fallback to any existing session in this workspace
    for (const entry of this.entries.values()) {
      if (entry.workspacePath === normalized) {
        entry.lastActiveAt = Date.now()
        this.activeSessionIdByWorkspace.set(normalized, entry.sessionId)
        return entry
      }
    }

    // 5. Create new entry for workspace
    const pendingKey = `${normalized}::__pending__`
    const inFlight = this.inFlightCreations.get(pendingKey)
    if (inFlight) {
      return await inFlight
    }

    const creationPromise = this.createEntry(normalized, undefined, sessionPath)
      .then((entry) => {
        this.pruneEntriesIfNecessary()
        const actualKey = this.makeKey(normalized, entry.sessionId)
        this.entries.set(actualKey, entry)
        this.activeSessionIdByWorkspace.set(normalized, entry.sessionId)
        this.inFlightCreations.delete(pendingKey)
        return entry
      })
      .catch((err) => {
        this.inFlightCreations.delete(pendingKey)
        throw err
      })

    this.inFlightCreations.set(pendingKey, creationPromise)
    return await creationPromise
  }

  private pruneEntriesIfNecessary(): void {
    if (this.entries.size < this.maxEntries) return

    // Find the least recently active session entry that is not actively streaming/prompting
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
      const entry = this.entries.get(oldestKey)
      if (entry) {
        this.stopSession(entry.workspacePath, entry.sessionId)
      }
    }
  }

  private emitEvent(payload: PiEventPayload) {
    for (const listener of this.eventListeners) {
      try {
        listener(payload)
      } catch (err) {
        console.error('Error in agent session event listener:', err)
      }
    }
  }

  public onEvent(callback: (data: PiEventPayload) => void): () => void {
    this.eventListeners.push(callback)
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== callback)
    }
  }

  public async prompt(
    workspacePath: string,
    message: string,
    images?: string[],
    sessionId?: string
  ): Promise<void> {
    const entry = await this.getOrCreateEntry(workspacePath, sessionId)
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

  public async abort(workspacePath: string, sessionId?: string): Promise<boolean> {
    if (sessionId) {
      const key = this.makeKey(workspacePath, sessionId)
      const entry = this.entries.get(key)
      if (entry) {
        await entry.runtime.session.abort()
        return true
      }
      return false
    }

    // If no sessionId specified, abort active session or all sessions for this workspace
    const normalized = workspacePath.trim()
    let abortedAny = false
    for (const entry of this.entries.values()) {
      if (entry.workspacePath === normalized) {
        await entry.runtime.session.abort()
        abortedAny = true
      }
    }
    return abortedAny
  }

  public async setModel(
    workspacePath: string,
    provider: string,
    modelId: string,
    sessionId?: string
  ): Promise<void> {
    const entry = await this.getOrCreateEntry(workspacePath, sessionId)
    const models = entry.runtime.session.modelRuntime.getAvailableSnapshot()
    const target = models.find((m: any) => m.provider === provider && m.id === modelId)
    if (!target) {
      throw new Error(`Model not found: ${provider}/${modelId}`)
    }
    await entry.runtime.session.setModel(target)
  }

  public async setThinkingLevel(
    workspacePath: string,
    level: string,
    sessionId?: string
  ): Promise<void> {
    const entry = await this.getOrCreateEntry(workspacePath, sessionId)
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

  public async getAvailableThinkingLevels(
    workspacePath: string,
    sessionId?: string
  ): Promise<{ levels: string[] }> {
    const entry = await this.getOrCreateEntry(workspacePath, sessionId)
    const levels = entry.runtime.session.getAvailableThinkingLevels()
    return { levels }
  }

  public async getState(workspacePath: string, sessionId?: string): Promise<AgentSessionState> {
    const entry = await this.getOrCreateEntry(workspacePath, sessionId)
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

  public async getMessages(workspacePath: string, sessionId?: string): Promise<{ messages: any[] }> {
    const entry = await this.getOrCreateEntry(workspacePath, sessionId)
    return { messages: entry.runtime.session.messages }
  }

  public async newSession(
    workspacePath: string
  ): Promise<{ sessionId: string; sessionPath?: string }> {
    const normalized = workspacePath.trim()
    const entry = await this.createEntry(normalized)
    this.pruneEntriesIfNecessary()
    const actualKey = this.makeKey(normalized, entry.sessionId)
    this.entries.set(actualKey, entry)
    this.activeSessionIdByWorkspace.set(normalized, entry.sessionId)
    return {
      sessionId: entry.sessionId,
      sessionPath: entry.runtime.session.sessionFile
    }
  }

  public async switchSession(
    workspacePath: string,
    sessionPath: string
  ): Promise<{ sessionId: string; sessionPath?: string }> {
    const entry = await this.getOrCreateEntry(workspacePath, undefined, sessionPath)
    return {
      sessionId: entry.sessionId,
      sessionPath: entry.sessionPath
    }
  }

  public async getSessionStats(workspacePath: string, sessionId?: string): Promise<any> {
    const entry = await this.getOrCreateEntry(workspacePath, sessionId)
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

  public stopSession(workspacePath: string, sessionIdOrPath: string): void {
    const normalized = workspacePath.trim()
    const target = sessionIdOrPath.trim()

    for (const [key, entry] of this.entries) {
      if (entry.workspacePath === normalized) {
        const matches =
          entry.sessionId === target ||
          entry.sessionPath === target ||
          entry.runtime.session.sessionFile === target ||
          key === this.makeKey(normalized, target) ||
          (entry.sessionPath && path.basename(entry.sessionPath, '.jsonl') === target) ||
          (entry.runtime.session.sessionFile &&
            path.basename(entry.runtime.session.sessionFile, '.jsonl') === target)

        if (matches) {
          try {
            entry.unsubscribe()
            entry.runtime.dispose()
          } catch {}
          this.entries.delete(key)
          if (this.activeSessionIdByWorkspace.get(normalized) === entry.sessionId) {
            this.activeSessionIdByWorkspace.delete(normalized)
          }
        }
      }
    }
  }

  public stopWorkspace(workspacePath: string): void {
    const normalized = workspacePath.trim()
    for (const [key, entry] of this.entries) {
      if (entry.workspacePath === normalized) {
        try {
          entry.unsubscribe()
          entry.runtime.dispose()
        } catch {}
        this.entries.delete(key)
      }
    }
    this.activeSessionIdByWorkspace.delete(normalized)
  }

  public stopAll(): void {
    for (const [, entry] of this.entries) {
      try {
        entry.unsubscribe()
        entry.runtime.dispose()
      } catch {}
    }
    this.entries.clear()
    this.activeSessionIdByWorkspace.clear()
  }
}
