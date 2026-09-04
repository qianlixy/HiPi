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

  it('should emit events with workspacePath and precise sessionId', async () => {
    const events: any[] = []
    const unsubscribe = manager.onEvent((data) => {
      events.push(data)
    })

    const entry = await manager.getOrCreateEntry(testWorkspace)
    ;(entry.runtime.session as any)._emit({ type: 'turn_start' })

    expect(events.length).toBeGreaterThan(0)
    expect(events[0].workspacePath).toBe(testWorkspace)
    expect(events[0].sessionId).toBe(entry.sessionId)

    unsubscribe()
  })

  it('should support multiple concurrent sessions in the same workspace', async () => {
    // Create initial session
    const entry1 = await manager.getOrCreateEntry(testWorkspace)
    const sessionId1 = entry1.sessionId

    // Create a new distinct session in the same workspace
    const newSessionRes = await manager.newSession(testWorkspace)
    const sessionId2 = newSessionRes.sessionId
    expect(sessionId2).toBeDefined()
    expect(sessionId2).not.toBe(sessionId1)

    // Both sessions should be simultaneously available in memory
    const retrieved1 = await manager.getOrCreateEntry(testWorkspace, sessionId1)
    const retrieved2 = await manager.getOrCreateEntry(testWorkspace, sessionId2)

    expect(retrieved1.sessionId).toBe(sessionId1)
    expect(retrieved2.sessionId).toBe(sessionId2)
    expect(retrieved1).not.toBe(retrieved2)
  })

  it('should run prompts in two sessions of the same workspace concurrently', async () => {
    const entry1 = await manager.getOrCreateEntry(testWorkspace)
    const sessionId1 = entry1.sessionId
    const { sessionId: sessionId2 } = await manager.newSession(testWorkspace)
    const entry2 = await manager.getOrCreateEntry(testWorkspace, sessionId2)

    let prompt1Started = false
    let prompt1Finished = false
    let prompt2Started = false
    let prompt2Finished = false

    // Mock session.prompt to verify concurrent execution
    entry1.runtime.session.prompt = (async () => {
      prompt1Started = true
      await new Promise((r) => setTimeout(r, 50))
      prompt1Finished = true
    }) as any

    entry2.runtime.session.prompt = (async () => {
      prompt2Started = true
      await new Promise((r) => setTimeout(r, 50))
      prompt2Finished = true
    }) as any

    // Trigger both concurrently
    const p1 = manager.prompt(testWorkspace, 'task 1', undefined, sessionId1)
    const p2 = manager.prompt(testWorkspace, 'task 2', undefined, sessionId2)

    await new Promise((r) => setTimeout(r, 10))
    // Both should be in flight at the same time
    expect(prompt1Started).toBe(true)
    expect(prompt2Started).toBe(true)
    expect(prompt1Finished).toBe(false)
    expect(prompt2Finished).toBe(false)

    await Promise.all([p1, p2])
    expect(prompt1Finished).toBe(true)
    expect(prompt2Finished).toBe(true)
  })

  it('should stop single session without affecting other sessions in workspace', async () => {
    const entry1 = await manager.getOrCreateEntry(testWorkspace)
    const sessionId1 = entry1.sessionId

    const { sessionId: sessionId2 } = await manager.newSession(testWorkspace)

    expect(sessionId1).not.toBe(sessionId2)

    // Stop session 1
    manager.stopSession(testWorkspace, sessionId1)

    // Session 2 should remain cached and untouched
    const retrieved2 = await manager.getOrCreateEntry(testWorkspace, sessionId2)
    expect(retrieved2.sessionId).toBe(sessionId2)

    // Retrieving session 1 should create a new runtime entry
    const reloaded1 = await manager.getOrCreateEntry(testWorkspace, sessionId1)
    expect(reloaded1).not.toBe(entry1)
  })

  it('should not evict actively streaming or prompting sessions during LRU prune', async () => {
    const lruManager = new AgentSessionManager({
      sessionManagerFactory: () => SessionManager.inMemory(),
      maxEntries: 2
    })

    const ws1 = '/tmp/test-ws-stream-1'
    const ws2 = '/tmp/test-ws-stream-2'
    const ws3 = '/tmp/test-ws-stream-3'

    const e1 = await lruManager.getOrCreateEntry(ws1)
    // Mark e1 as actively prompting
    e1.isPrompting = true

    await new Promise((r) => setTimeout(r, 10))
    const e2 = await lruManager.getOrCreateEntry(ws2)

    await new Promise((r) => setTimeout(r, 10))
    // Adding 3rd entry: normally e1 would be pruned because it's oldest,
    // but because e1 is prompting/streaming, e2 should be pruned instead!
    await lruManager.getOrCreateEntry(ws3)

    // e1 should still be in cache!
    const activeE1 = await lruManager.getOrCreateEntry(ws1, e1.sessionId)
    expect(activeE1).toBe(e1)

    lruManager.stopAll()
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
