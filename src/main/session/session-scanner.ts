import fs from 'fs'
import path from 'path'
import os from 'os'
import readline from 'readline'
import { SessionSummary, ChatMessage, ToolExecution } from '../types'

export class SessionScanner {
  private baseDir: string

  constructor() {
    this.baseDir = path.join(os.homedir(), '.pi', 'agent', 'sessions')
  }

  public getBaseDir(): string {
    return this.baseDir
  }

  /**
   * Scan all sessions grouped by workspace
   */
  public async scanAllSessions(): Promise<SessionSummary[]> {
    if (!fs.existsSync(this.baseDir)) {
      return []
    }

    const summaries: SessionSummary[] = []
    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(this.baseDir, entry.name)
        const sessionFiles = fs
          .readdirSync(dirPath)
          .filter((f) => f.endsWith('.jsonl'))

        for (const file of sessionFiles) {
          const fullPath = path.join(dirPath, file)
          const summary = await this.readSessionSummary(fullPath)
          if (summary) {
            summaries.push(summary)
          }
        }
      }
    }

    // Sort by timestamp descending
    return summaries.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Scan sessions for a specific workspace path
   */
  public async scanWorkspaceSessions(workspacePath: string): Promise<SessionSummary[]> {
    const all = await this.scanAllSessions()
    const target = path.resolve(workspacePath)
    return all.filter((s) => path.resolve(s.workspacePath) === target)
  }

  /**
   * Read the first few lines of a session jsonl file to extract summary metadata
   */
  private async readSessionSummary(filePath: string): Promise<SessionSummary | null> {
    try {
      const stats = fs.statSync(filePath)
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' })
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      })

      let sessionId = path.basename(filePath, '.jsonl')
      let workspacePath = ''
      let sessionName: string | undefined
      let firstUserPrompt: string | undefined
      let timestamp = stats.mtimeMs
      let messageCount = 0
      let lineCount = 0

      for await (const line of rl) {
        lineCount++
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const entry = JSON.parse(trimmed)
          if (entry.type === 'session') {
            if (entry.id) sessionId = entry.id
            if (entry.cwd) workspacePath = entry.cwd
            if (entry.timestamp) {
              const parsed = new Date(entry.timestamp).getTime()
              if (!isNaN(parsed)) timestamp = parsed
            }
          } else if (entry.type === 'session_info' && entry.name) {
            sessionName = entry.name
          } else if (entry.type === 'message') {
            messageCount++
            if (!firstUserPrompt && entry.message?.role === 'user') {
              const c = entry.message.content
              if (typeof c === 'string') {
                firstUserPrompt = c.slice(0, 60)
              } else if (Array.isArray(c)) {
                const textPart = c.find((p: any) => p.type === 'text')
                if (textPart?.text) {
                  firstUserPrompt = textPart.text.slice(0, 60)
                }
              }
            }
          }
        } catch {}

        // We only need the first ~30 lines for title/preview, unless counting
        if (lineCount > 50 && firstUserPrompt) {
          break
        }
      }

      if (!workspacePath) {
        // Fallback: derive from folder name
        const parentDir = path.basename(path.dirname(filePath))
        workspacePath = parentDir.replace(/^--/, '/').replace(/--$/, '').replace(/-/g, '/')
      }

      return {
        id: sessionId,
        path: filePath,
        workspacePath,
        name: sessionName || firstUserPrompt || 'New Conversation',
        preview: firstUserPrompt,
        timestamp,
        messageCount
      }
    } catch {
      return null
    }
  }

  /**
   * Parse full message history directly from a session jsonl file
   */
  public async getSessionMessages(filePath: string): Promise<ChatMessage[]> {
    if (!fs.existsSync(filePath)) {
      return []
    }

    try {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' })
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      })

      const rawMessages: any[] = []
      const toolResultsMap = new Map<string, { output: string; isError: boolean }>()

      for await (const line of rl) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const entry = JSON.parse(trimmed)
          if (entry.type === 'message' && entry.message) {
            const msg = entry.message
            if (msg.role === 'toolResult') {
              const toolCallId = msg.toolCallId || msg.id
              let outputText = ''
              if (typeof msg.content === 'string') {
                outputText = msg.content
              } else if (Array.isArray(msg.content)) {
                outputText = msg.content
                  .map((p: any) => (p.text !== undefined ? p.text : JSON.stringify(p)))
                  .join('\n')
              }
              if (toolCallId) {
                toolResultsMap.set(toolCallId, {
                  output: outputText,
                  isError: !!msg.isError
                })
              }
            } else if (msg.role === 'user' || msg.role === 'assistant') {
              rawMessages.push({
                ...msg,
                id: entry.id || msg.id
              })
            }
          }
        } catch {}
      }

      // Convert to ChatMessage format with tool results attached
      const formatted: ChatMessage[] = rawMessages.map((msg, idx) => {
        let text = ''
        const toolExecutions: ToolExecution[] = []

        if (typeof msg.content === 'string') {
          text = msg.content
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'text') {
              text += (text ? '\n' : '') + part.text
            } else if (part.type === 'toolCall') {
              const callId = part.id
              const toolResult = toolResultsMap.get(callId)
              toolExecutions.push({
                toolCallId: callId,
                toolName: part.name,
                arguments: part.arguments || {},
                status: toolResult ? (toolResult.isError ? 'failed' : 'completed') : 'completed',
                output: toolResult ? toolResult.output : ''
              })
            }
          }
        }

        if (!text && (msg.errorMessage || msg.stopReason === 'error')) {
          text = `⚠️ 模型调用失败: ${msg.errorMessage || '服务商返回错误 (未知原因)'}`
        }

        return {
          id: msg.id || `msg-${idx}`,
          role: msg.role,
          content: text,
          timestamp: msg.timestamp || (msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now()),
          toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined
        }
      })

      return formatted
    } catch (e) {
      console.error('Failed to parse session messages from file:', filePath, e)
      return []
    }
  }

  public deleteSession(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        return true
      }
    } catch {}
    return false
  }
}
