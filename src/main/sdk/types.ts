import { AppSettings, Model, PiEventPayload } from '../types'

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
  prompt(workspacePath: string, message: string, images?: string[], sessionId?: string): Promise<void>
  abort(workspacePath: string, sessionId?: string): Promise<boolean>
  setModel(workspacePath: string, provider: string, modelId: string, sessionId?: string): Promise<void>
  setThinkingLevel(workspacePath: string, level: string, sessionId?: string): Promise<void>
  getAvailableModels(workspacePath: string): Promise<{ models: Model[] }>
  getAvailableThinkingLevels(workspacePath: string, sessionId?: string): Promise<{ levels: string[] }>
  getState(workspacePath: string, sessionId?: string): Promise<AgentSessionState>
  getMessages(workspacePath: string, sessionId?: string): Promise<{ messages: any[] }>
  newSession(workspacePath: string): Promise<any>
  switchSession(workspacePath: string, sessionPath: string): Promise<any>
  getSessionStats(workspacePath: string, sessionId?: string): Promise<any>
  syncSettings(settings: AppSettings): Promise<void>
  stopWorkspace(workspacePath: string): void
  stopSession?(workspacePath: string, sessionId: string): void
  stopAll(): void
  onEvent(callback: (data: PiEventPayload) => void): () => void
}
