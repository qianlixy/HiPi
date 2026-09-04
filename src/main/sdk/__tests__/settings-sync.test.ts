import { describe, it, expect } from 'vitest'
import { SessionManager } from '@earendil-works/pi-coding-agent'
import { AgentSessionManager } from '../agent-session-manager'
import { AppSettings } from '../../types'

describe('AgentSessionManager - settings sync', () => {
  it('should sync api keys and rebuild providers without error', async () => {
    const manager = new AgentSessionManager({
      sessionManagerFactory: () => SessionManager.inMemory()
    })

    const sampleSettings: AppSettings = {
      apiKeys: {
        anthropic: 'test-anthropic-key',
        openai: 'test-openai-key',
        google: 'test-google-key',
        deepseek: 'test-deepseek-key',
        openrouter: 'test-openrouter-key'
      },
      workspaces: []
    }

    await expect(manager.syncSettings(sampleSettings)).resolves.not.toThrow()

    // Can still retrieve available models
    const { models } = await manager.getAvailableModels()
    expect(Array.isArray(models)).toBe(true)

    manager.stopAll()
  })
})
