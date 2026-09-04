import fs from 'fs'
import path from 'path'
import os from 'os'
import { AppSettings, Workspace, CustomProviderConfig } from './types'

export class SettingsStore {
  private configPath: string
  private piAgentDir: string
  private settings: AppSettings

  constructor() {
    const configDir = path.join(os.homedir(), '.hipi')
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    this.configPath = path.join(configDir, 'settings.json')
    this.piAgentDir = path.join(os.homedir(), '.pi', 'agent')
    this.settings = this.load()
    // Sync models.json on startup
    this.syncPiModelsJson()
  }

  private load(): AppSettings {
    const defaultSettings: AppSettings = {
      apiKeys: {
        anthropic: process.env.ANTHROPIC_API_KEY || '',
        openai: process.env.OPENAI_API_KEY || '',
        google: process.env.GEMINI_API_KEY || '',
        deepseek: process.env.DEEPSEEK_API_KEY || '',
        openrouter: process.env.OPENROUTER_API_KEY || ''
      },
      customProviders: [],
      workspaces: []
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8')
        const parsed = JSON.parse(raw)
        return {
          ...defaultSettings,
          ...parsed,
          apiKeys: {
            ...defaultSettings.apiKeys,
            ...(parsed.apiKeys || {})
          },
          customProviders: parsed.customProviders || []
        }
      }
    } catch {}

    return defaultSettings
  }

  public getSettings(): AppSettings {
    return this.settings
  }

  public saveSettings(newSettings: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.settings,
      ...newSettings,
      apiKeys: {
        ...this.settings.apiKeys,
        ...(newSettings.apiKeys || {})
      },
      customProviders: newSettings.customProviders !== undefined
        ? newSettings.customProviders
        : this.settings.customProviders
    }

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf8')
    } catch {}

    // Sync to ~/.pi/agent/models.json
    this.syncPiModelsJson()

    return this.settings
  }

  /**
   * Normalize OpenAI-compatible Base URL:
   * e.g. "https://api.example.com" -> "https://api.example.com/v1"
   */
  public normalizeBaseUrl(rawUrl: string): string {
    let url = rawUrl.trim().replace(/\/+$/, '')
    if (!url) return url
    // If it doesn't end with /v1 and doesn't end with /api (ollama native)
    if (!url.endsWith('/v1') && !url.endsWith('/api')) {
      url = `${url}/v1`
    }
    return url
  }

  /**
   * Synchronize custom providers to ~/.pi/agent/models.json following official PI specs
   */
  public syncPiModelsJson(): void {
    try {
      if (!fs.existsSync(this.piAgentDir)) {
        fs.mkdirSync(this.piAgentDir, { recursive: true })
      }

      const modelsJsonPath = path.join(this.piAgentDir, 'models.json')
      let existingConfig: any = { providers: {} }

      if (fs.existsSync(modelsJsonPath)) {
        try {
          existingConfig = JSON.parse(fs.readFileSync(modelsJsonPath, 'utf8'))
          if (!existingConfig.providers) existingConfig.providers = {}
        } catch {}
      }

      const customProviders = this.settings.customProviders || []

      for (const cp of customProviders) {
        if (!cp.id || !cp.baseUrl) continue
        const providerId = cp.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')

        // Normalize baseUrl (ensure /v1 for openai-completions)
        const finalBaseUrl = this.normalizeBaseUrl(cp.baseUrl)

        // Parse models
        const rawModelList = cp.models
          ? cp.models
              .split(/[\n,]/)
              .map((m) => m.trim())
              .filter(Boolean)
          : []

        const modelEntries = rawModelList.map((mId) => ({
          id: mId,
          name: `${cp.name ? cp.name + ' - ' : ''}${mId}`,
          reasoning: false,
          input: ['text'],
          contextWindow: 128000,
          maxTokens: 8192
        }))

        const providerPayload: any = {
          baseUrl: finalBaseUrl,
          api: 'openai-completions',
          apiKey: cp.apiKey ? cp.apiKey.trim() : 'placeholder',
          models: modelEntries
        }

        if (cp.compat) {
          providerPayload.compat = {}
          if (cp.compat.supportsDeveloperRole !== undefined) {
            providerPayload.compat.supportsDeveloperRole = cp.compat.supportsDeveloperRole
          }
          if (cp.compat.supportsReasoningEffort !== undefined) {
            providerPayload.compat.supportsReasoningEffort = cp.compat.supportsReasoningEffort
          }
        }

        existingConfig.providers[providerId] = providerPayload
      }

      fs.writeFileSync(modelsJsonPath, JSON.stringify(existingConfig, null, 2), 'utf8')
    } catch (err) {
      console.error('Failed to sync ~/.pi/agent/models.json:', err)
    }
  }

  public getEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {}
    const { apiKeys } = this.settings
    if (apiKeys.anthropic) env.ANTHROPIC_API_KEY = apiKeys.anthropic
    if (apiKeys.openai) env.OPENAI_API_KEY = apiKeys.openai
    if (apiKeys.google) {
      env.GEMINI_API_KEY = apiKeys.google
      env.GOOGLE_API_KEY = apiKeys.google
    }
    if (apiKeys.deepseek) env.DEEPSEEK_API_KEY = apiKeys.deepseek
    if (apiKeys.openrouter) env.OPENROUTER_API_KEY = apiKeys.openrouter
    return env
  }
}
