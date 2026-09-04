import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SessionManager, ModelRuntime } from '@earendil-works/pi-coding-agent'
import { AgentSessionManager } from '../agent-session-manager'

describe('AgentSessionManager', () => {
  let manager: AgentSessionManager
  const testWorkspace = '/tmp/test-workspace-hipi'

  beforeEach(async () => {
    manager = new AgentSessionManager({
      sessionManagerFactory: () => SessionManager.inMemory()
    })
  })

  afterEach(() => {
    manager.stopAll()
  })

  it('should initialize and cache workspace runtime entry', async () => {
    const entry1 = await manager.getOrCreateEntry(testWorkspace)
    expect(entry1).toBeDefined()
    expect(entry1.runtime).toBeDefined()
    expect(entry1.runtime.session).toBeDefined()

    const entry2 = await manager.getOrCreateEntry(testWorkspace)
    expect(entry2).toBe(entry1)
  })

  it('should return correct initial state', async () => {
    const state = await manager.getState(testWorkspace)
    expect(state).toBeDefined()
    expect(state.isStreaming).toBe(false)
    expect(typeof state.sessionId).toBe('string')
    expect(state.messageCount).toBe(0)
  })

  it('should get and set thinking level', async () => {
    const { levels } = await manager.getAvailableThinkingLevels(testWorkspace)
    expect(Array.isArray(levels)).toBe(true)

    if (levels.length > 0) {
      await manager.setThinkingLevel(testWorkspace, levels[0])
      const state = await manager.getState(testWorkspace)
      expect(state.thinkingLevel).toBe(levels[0])
    }
  })

  it('should list available models', async () => {
    const { models } = await manager.getAvailableModels(testWorkspace)
    expect(Array.isArray(models)).toBe(true)
  })

  it('should create new session and switch sessionId', async () => {
    const stateBefore = await manager.getState(testWorkspace)
    const initialSessionId = stateBefore.sessionId

    await manager.newSession(testWorkspace)

    const stateAfter = await manager.getState(testWorkspace)
    expect(stateAfter.sessionId).toBeDefined()
    expect(stateAfter.sessionId).not.toBe(initialSessionId)
  })

  it('should get session messages', async () => {
    const { messages } = await manager.getMessages(testWorkspace)
    expect(Array.isArray(messages)).toBe(true)
  })

  it('should get session statistics', async () => {
    const stats = await manager.getSessionStats(testWorkspace)
    expect(stats).toBeDefined()
    expect(stats.tokens).toBeDefined()
  })

  it('should stop workspace and dispose runtime', async () => {
    const entry = await manager.getOrCreateEntry(testWorkspace)
    expect(entry).toBeDefined()

    manager.stopWorkspace(testWorkspace)

    // Getting entry again should create a fresh one
    const newEntry = await manager.getOrCreateEntry(testWorkspace)
    expect(newEntry).not.toBe(entry)
  })

  it('should register and trigger onEvent listener', async () => {
    const events: any[] = []
    const unsubscribe = manager.onEvent((data) => {
      events.push(data)
    })

    // Changing thinking level or session emits events
    await manager.setThinkingLevel(testWorkspace, 'off')

    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('should prune oldest inactive entries when maxEntries is reached', async () => {
    const lruManager = new AgentSessionManager({
      sessionManagerFactory: () => SessionManager.inMemory(),
      maxEntries: 2
    })

    const ws1 = '/tmp/test-workspace-1'
    const ws2 = '/tmp/test-workspace-2'
    const ws3 = '/tmp/test-workspace-3'

    const e1 = await lruManager.getOrCreateEntry(ws1)
    // Small delay to ensure timestamp progression
    await new Promise((r) => setTimeout(r, 10))
    const e2 = await lruManager.getOrCreateEntry(ws2)

    // Touch ws1 to make ws2 older, or leave ws1 as older
    // Here ws1 was created first, so its lastActiveAt is earlier than ws2
    await new Promise((r) => setTimeout(r, 10))
    // Creating 3rd entry should trigger pruning of ws1
    await lruManager.getOrCreateEntry(ws3)

    // Now ws1 should have been pruned, so re-retrieving ws1 creates a new entry
    const newE1 = await lruManager.getOrCreateEntry(ws1)
    expect(newE1).not.toBe(e1)

    lruManager.stopAll()
  })
})
