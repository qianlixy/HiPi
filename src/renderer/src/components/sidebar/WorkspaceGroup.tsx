import React, { useState } from 'react'
import { Folder, ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { Workspace, SessionSummary } from '../../types'
import { SessionItem } from './SessionItem'

interface WorkspaceGroupProps {
  workspace: Workspace
  isActive: boolean
  sessions: SessionSummary[]
  activeSessionId?: string
  streamingMap?: Record<string, boolean>
  onSelectWorkspace: (ws: Workspace) => void
  onSelectSession: (ws: Workspace, session: SessionSummary) => void
  onNewSession: (ws: Workspace) => void
  onDeleteSession: (session: SessionSummary) => void
  onRemoveWorkspace: (ws: Workspace) => void
}

export const WorkspaceGroup: React.FC<WorkspaceGroupProps> = ({
  workspace,
  isActive,
  sessions,
  activeSessionId,
  streamingMap,
  onSelectWorkspace,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRemoveWorkspace
}) => {
  const [isOpen, setIsOpen] = useState(true)
  const isWorkspaceStreaming =
    sessions.some((s) => !!streamingMap?.[s.id]) ||
    !!streamingMap?.[`${workspace.path}::__default__`]

  return (
    <div className="mb-2">
      {/* Workspace Header */}
      <div
        onClick={() => onSelectWorkspace(workspace)}
        className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
          isActive ? 'bg-[#1c2128] text-white' : 'text-gray-300 hover:bg-[#161b22]'
        }`}
        title={workspace.path}
      >
        <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(!isOpen)
            }}
            className="p-0.5 hover:bg-[#30363d] rounded text-gray-400"
          >
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <div className="relative flex-shrink-0">
            <Folder className="w-3.5 h-3.5 text-accent" />
            {isWorkspaceStreaming && (
              <span
                data-testid="workspace-streaming-indicator"
                className="absolute -top-0.5 -right-0.5 flex h-2 w-2"
                title="后台任务运行中"
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            )}
          </div>
          <span className="truncate">{workspace.name}</span>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNewSession(workspace)
            }}
            className="p-1 rounded hover:bg-[#30363d] text-gray-400 hover:text-white"
            title="新建会话"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemoveWorkspace(workspace)
            }}
            className="p-1 rounded hover:bg-[#30363d] text-gray-400 hover:text-red-400"
            title="移除工作空间"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Sub Session List */}
      {isOpen && (
        <div className="ml-3 pl-2 mt-1 border-l border-[#21262d] space-y-0.5">
          {sessions.length === 0 ? (
            <div className="px-2 py-1 text-[11px] text-gray-500 italic">暂无历史会话</div>
          ) : (
            sessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                isActive={activeSessionId === s.id}
                isStreaming={!!streamingMap?.[s.id]}
                onSelect={(sess) => onSelectSession(workspace, sess)}
                onDelete={onDeleteSession}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
