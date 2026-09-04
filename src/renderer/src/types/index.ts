export interface Workspace {
  id: string
  name: string
  path: string
}

export interface SessionSummary {
  id: string
  path: string
  workspacePath: string
  name?: string
  preview?: string
  timestamp: number
  messageCount?: number
}

export interface Model {
  id: string
  name: string
  provider: string
  description?: string
  contextWindow?: number
  maxTokens?: number
  supportsThinking?: boolean
}

export interface ToolExecution {
  toolCallId: string
  toolName: string
  arguments: Record<string, any>
  status: 'running' | 'completed' | 'failed'
  output?: string
  error?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
  toolExecutions?: ToolExecution[]
}

export interface PiRuntimeStatus {
  installed: boolean
  version: string | null
  latestVersion: string | null
  runtimeDir: string
  isUpdating: boolean
  error: string | null
}

export interface CustomProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string
  compat?: {
    supportsDeveloperRole?: boolean
    supportsReasoningEffort?: boolean
  }
}

export interface AppSettings {
  apiKeys: {
    anthropic?: string
    openai?: string
    google?: string
    deepseek?: string
    openrouter?: string
    [key: string]: string | undefined
  }
  customProviders?: CustomProviderConfig[]
  workspaces: Workspace[]
  activeWorkspacePath?: string
  activeSessionId?: string
}
