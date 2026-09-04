import React, { useEffect, useState } from 'react'
import { Sidebar } from './components/sidebar/Sidebar'
import { Header } from './components/header/Header'
import { ChatArea } from './components/chat/ChatArea'
import { SettingsModal } from './components/settings/SettingsModal'
import {
  Workspace,
  SessionSummary,
  ChatMessage,
  AppSettings,
  PiRuntimeStatus
} from './types'

export const App: React.FC = () => {
  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | undefined>(undefined)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [runtimeStatus, setRuntimeStatus] = useState<PiRuntimeStatus | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [currentModel, setCurrentModel] = useState<{ provider: string; modelId: string } | undefined>(undefined)
  const [thinkingLevel, setThinkingLevel] = useState<string>('off')
  const [sessionStats, setSessionStats] = useState<{ tokens?: number; cost?: number } | undefined>(undefined)

  // Initialize
  useEffect(() => {
    loadSettingsAndWorkspaces()
    loadRuntimeStatus()
    loadAllSessions()

    // Poll runtime status
    const statusInterval = setInterval(loadRuntimeStatus, 10000)
    return () => clearInterval(statusInterval)
  }, [])

  const loadSettingsAndWorkspaces = async () => {
    try {
      const s = await window.hipiApi.settings.get()
      const wsList = s.workspaces || []
      setWorkspaces(wsList)

      if (wsList.length > 0) {
        const target = s.activeWorkspacePath
          ? wsList.find((w) => w.path === s.activeWorkspacePath) || wsList[0]
          : wsList[0]
        selectWorkspace(target)
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  const loadRuntimeStatus = async () => {
    try {
      const status = await window.hipiApi.pi.getRuntimeStatus()
      setRuntimeStatus(status)
    } catch { }
  }

  const loadAllSessions = async () => {
    try {
      const all = await window.hipiApi.session.listAll()
      setSessions(all)
    } catch { }
  }

  const refreshStats = (wsPath: string) => {
    window.hipiApi.pi
      .getSessionStats(wsPath)
      .then((data) => {
        if (data && data.tokens) {
          setSessionStats({ tokens: data.tokens.total, cost: data.cost })
        }
      })
      .catch(() => { })
  }

  const parsePiMessages = (rawMessages: any[]): ChatMessage[] => {
    if (!Array.isArray(rawMessages)) return []

    const messages: ChatMessage[] = []
    const toolResultsMap = new Map<string, { output: string; isError: boolean }>()

    // First collect all toolResult events
    for (const m of rawMessages) {
      if (m.role === 'toolResult') {
        const callId = m.toolCallId || m.id
        let outText = ''
        if (typeof m.content === 'string') outText = m.content
        else if (Array.isArray(m.content)) {
          outText = m.content
            .map((p: any) => (p.text !== undefined ? p.text : JSON.stringify(p)))
            .join('\n')
        }
        if (callId) {
          toolResultsMap.set(callId, {
            output: outText,
            isError: !!m.isError
          })
        }
      }
    }

    // Then build user and assistant messages
    for (let idx = 0; idx < rawMessages.length; idx++) {
      const m = rawMessages[idx]
      if (m.role !== 'user' && m.role !== 'assistant') continue

      let text = ''
      const toolExecutions: any[] = []

      if (typeof m.content === 'string') {
        text = m.content
      } else if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part.type === 'text') {
            text += (text ? '\n' : '') + part.text
          } else if (part.type === 'toolCall') {
            const callId = part.id
            const res = toolResultsMap.get(callId)
            toolExecutions.push({
              toolCallId: callId,
              toolName: part.name,
              arguments: part.arguments || {},
              status: res ? (res.isError ? 'failed' : 'completed') : 'completed',
              output: res ? res.output : ''
            })
          }
        }
      }

      if (!text && (m.errorMessage || m.stopReason === 'error')) {
        text = `⚠️ 模型调用失败: ${m.errorMessage || '服务商返回错误 (未知原因)'}`
      }

      messages.push({
        id: m.id || `msg-${idx}`,
        role: m.role,
        content: text,
        timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
        toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined
      })
    }

    return messages
  }

  const loadWorkspaceMessages = async (wsPath: string) => {
    try {
      const res = await window.hipiApi.pi.getMessages(wsPath)
      if (res && Array.isArray(res.messages)) {
        setMessages(parsePiMessages(res.messages))
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
  }

  // Subscribe to PI RPC streaming events
  useEffect(() => {
    const unsubscribe = window.hipiApi.pi.onEvent(({ workspacePath, event }) => {
      if (!activeWorkspace || activeWorkspace.path !== workspacePath) return

      const evType = event.type

      if (evType === 'turn_start' || evType === 'agent_start') {
        setIsStreaming(true)
      } else if (evType === 'turn_end' || evType === 'agent_end' || evType === 'agent_settled') {
        setIsStreaming(false)
        refreshStats(workspacePath)
        loadAllSessions()

        // If turn ended with an empty assistant message, show warning
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          if (
            last.role === 'assistant' &&
            !last.content &&
            (!last.toolExecutions || last.toolExecutions.length === 0)
          ) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: '⚠️ 未收到回复内容。通常为 Base URL 缺少 /v1 路径、模型 ID 不匹配或 API Key 无效。',
                isStreaming: false
              }
            ]
          }
          return prev
        })
      } else if (evType === 'message_start') {
        const msg = event.message
        if (msg && msg.role === 'assistant') {
          setMessages((prev) => [
            ...prev,
            {
              id: msg.id || `ast-${Date.now()}`,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
              isStreaming: true,
              toolExecutions: []
            }
          ])
        }
      } else if (evType === 'message_update') {
        // Delta stream
        const delta = event.delta || ''
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          if (last.role !== 'assistant') return prev
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: last.content + delta,
              isStreaming: true
            }
          ]
        })
      } else if (evType === 'message_end') {
        const msg = event.message
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          let content = last.content
          if (!content && (msg?.errorMessage || msg?.stopReason === 'error')) {
            content = `⚠️ 模型调用失败: ${msg?.errorMessage || '服务商返回错误'}`
          }
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content,
              isStreaming: false
            }
          ]
        })
      } else if (evType === 'tool_execution_start') {
        const toolCallId = event.toolCallId || `tool-${Date.now()}`
        const toolName = event.toolName || 'tool'
        const args = event.args || {}

        setMessages((prev) => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          if (last.role !== 'assistant') return prev
          const existingTools = last.toolExecutions || []
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolExecutions: [
                ...existingTools,
                {
                  toolCallId,
                  toolName,
                  arguments: args,
                  status: 'running',
                  output: ''
                }
              ]
            }
          ]
        })
      } else if (evType === 'tool_execution_update' || evType === 'bash_execution_update') {
        const toolCallId = event.toolCallId
        const output = event.output || event.text || ''

        setMessages((prev) => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          if (!last.toolExecutions) return prev
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolExecutions: last.toolExecutions.map((t) =>
                (!toolCallId || t.toolCallId === toolCallId)
                  ? { ...t, output: (t.output || '') + output }
                  : t
              )
            }
          ]
        })
      } else if (evType === 'tool_execution_end') {
        const toolCallId = event.toolCallId
        const isError = event.isError
        const result = event.result

        setMessages((prev) => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          if (!last.toolExecutions) return prev
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolExecutions: last.toolExecutions.map((t) =>
                (!toolCallId || t.toolCallId === toolCallId)
                  ? {
                    ...t,
                    status: isError ? 'failed' : 'completed',
                    output: result?.output || t.output || '',
                    error: isError ? (result?.error || 'Execution failed') : undefined
                  }
                  : t
              )
            }
          ]
        })
      } else if (evType === 'model_changed') {
        if (event.model) {
          setCurrentModel({ provider: event.model.provider, modelId: event.model.id })
        }
      }
    })

    return () => unsubscribe()
  }, [activeWorkspace])

  // Actions
  const handleOpenFolderDialog = async () => {
    const res = await window.hipiApi.workspace.openDialog()
    if (res) {
      const updated = await window.hipiApi.workspace.add(res)
      setWorkspaces(updated)
      const found = updated.find((w) => w.path === res.path)
      if (found) {
        selectWorkspace(found)
      }
    }
  }

  const handleSelectSession = async (ws: Workspace, session: SessionSummary) => {
    if (activeWorkspace?.path !== ws.path) {
      setActiveWorkspace(ws)
      window.hipiApi.settings.save({ activeWorkspacePath: ws.path })
    }
    setActiveSessionId(session.id)

    // 1. Instantly load complete historical messages from session file
    try {
      const historical = await window.hipiApi.session.getMessages(session.path)
      if (historical && Array.isArray(historical) && historical.length > 0) {
        setMessages(historical)
      } else {
        setMessages([])
      }
    } catch (err) {
      console.warn('Failed to parse session file directly:', err)
    }

    // 2. Synchronize PI background process session
    try {
      await window.hipiApi.pi.switchSession({
        workspacePath: ws.path,
        sessionPath: session.path
      })
      // Sync model and stats
      const state = await window.hipiApi.pi.getState(ws.path)
      if (state && state.model) {
        setCurrentModel({ provider: state.model.provider, modelId: state.model.id })
      }
      refreshStats(ws.path)
    } catch (e) {
      console.error('Failed to switch PI session:', e)
    }
  }

  const handleNewSession = async (ws?: Workspace) => {
    const targetWs = ws || activeWorkspace
    if (!targetWs) return
    try {
      await window.hipiApi.pi.newSession(targetWs.path)
      setMessages([])
      setActiveSessionId(undefined)
      loadAllSessions()
      refreshStats(targetWs.path)
    } catch (e) {
      console.error('Failed to create new session:', e)
    }
  }

  const handleDeleteSession = async (session: SessionSummary) => {
    await window.hipiApi.session.delete(session.path)
    if (activeSessionId === session.id) {
      setMessages([])
      setActiveSessionId(undefined)
    }
    loadAllSessions()
  }

  const handleRemoveWorkspace = async (ws: Workspace) => {
    const updated = await window.hipiApi.workspace.remove(ws.path)
    setWorkspaces(updated)
    if (activeWorkspace?.path === ws.path) {
      if (updated.length > 0) {
        selectWorkspace(updated[0])
      } else {
        setActiveWorkspace(undefined)
        setMessages([])
      }
    }
    loadAllSessions()
  }

  const handleSendPrompt = async (messageText: string) => {
    if (!activeWorkspace || isStreaming) return

    // Append user message immediately
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    }
    setMessages((prev) => [...prev, userMsg])
    setIsStreaming(true)

    try {
      await window.hipiApi.pi.sendPrompt({
        workspacePath: activeWorkspace.path,
        message: messageText
      })
    } catch (err: any) {
      console.error('Prompt send error:', err)
      setIsStreaming(false)
      // Append assistant error message
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ 发送失败: ${err.message || String(err)}。请在设置中检查 API Key 是否已配置。`,
          timestamp: Date.now()
        }
      ])
    }
  }

  const handleAbort = async () => {
    if (!activeWorkspace) return
    await window.hipiApi.pi.abort(activeWorkspace.path)
    setIsStreaming(false)
  }

  const handleModelChange = async (provider: string, modelId: string) => {
    if (!activeWorkspace) return
    try {
      await window.hipiApi.pi.setModel({
        workspacePath: activeWorkspace.path,
        provider,
        modelId
      })
      setCurrentModel({ provider, modelId })
    } catch (e) {
      console.error('Failed to change model:', e)
    }
  }

  const handleThinkingLevelChange = async (level: string) => {
    if (!activeWorkspace) return
    try {
      await window.hipiApi.pi.setThinkingLevel({
        workspacePath: activeWorkspace.path,
        level
      })
      setThinkingLevel(level)
    } catch (e) {
      console.error('Failed to change thinking level:', e)
    }
  }

  const selectWorkspace = async (ws: Workspace) => {
    setActiveWorkspace(ws)
    // Save to settings
    window.hipiApi.settings.save({ activeWorkspacePath: ws.path })

    // Read current workspace state (model, thinking level, session)
    try {
      const state = await window.hipiApi.pi.getState(ws.path)
      if (state && state.model) {
        setCurrentModel({ provider: state.model.provider, modelId: state.model.id })
      }
      if (state && state.thinkingLevel) {
        setThinkingLevel(state.thinkingLevel)
      }
      if (state && state.sessionId) {
        setActiveSessionId(state.sessionId)
      }
    } catch { }

    loadWorkspaceMessages(ws.path)
    refreshStats(ws.path)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d1117] text-gray-100 font-sans">
      {/* Left Sidebar */}
      <Sidebar
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        sessions={sessions}
        activeSessionId={activeSessionId}
        runtimeStatus={runtimeStatus}
        onOpenFolderDialog={handleOpenFolderDialog}
        onSelectWorkspace={selectWorkspace}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onRemoveWorkspace={handleRemoveWorkspace}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#0d1117]">
        <Header
          activeWorkspace={activeWorkspace}
          currentModel={currentModel}
          thinkingLevel={thinkingLevel}
          sessionStats={sessionStats}
          onModelChange={handleModelChange}
          onThinkingLevelChange={handleThinkingLevelChange}
          onNewSession={() => handleNewSession()}
        />

        <ChatArea
          workspace={activeWorkspace}
          messages={messages}
          isStreaming={isStreaming}
          onSendMessage={handleSendPrompt}
          onAbort={handleAbort}
          onOpenFolderDialog={handleOpenFolderDialog}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={(newSettings) => {
          if (activeWorkspace) {
            loadWorkspaceMessages(activeWorkspace.path)
          }
        }}
      />
    </div>
  )
}
