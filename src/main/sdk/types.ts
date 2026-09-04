import { AppSettings, Model } from '../types'

export interface AgentSessionState {
  model?: Model
  thinkingLevel?: string
  isStreaming: boolean
  sessionId?: string
  sessionFile?: string
  sessionName?: string
  messageCount: number
}

export interface IAgentSessionService {
  prompt(workspacePath: string, message: string, images?: string[]): Promise<void>
  abort(workspacePath: string): Promise<boolean>
  setModel(workspacePath: string, provider: string, modelId: string): Promise<void>
  setThinkingLevel(workspacePath: string, level: string): Promise<void>
  getAvailableModels(workspacePath: string): Promise<{ models: Model[] }>
  getAvailableThinkingLevels(workspacePath: string): Promise<{ levels: string[] }>
  getState(workspacePath: string): Promise<AgentSessionState>
  getMessages(workspacePath: string): Promise<{ messages: any[] }>
  newSession(workspacePath: string): Promise<any>
  switchSession(workspacePath: string, sessionPath: string): Promise<any>
  getSessionStats(workspacePath: string): Promise<any>
  syncSettings(settings: AppSettings): Promise<void>
  stopWorkspace(workspacePath: string): void
  stopAll(): void
  onEvent(callback: (data: { workspacePath: string; event: any }) => void): () => void
}
