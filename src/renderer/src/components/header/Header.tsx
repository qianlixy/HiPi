import React from 'react'
import { Folder, Plus, BarChart2 } from 'lucide-react'
import { Workspace } from '../../types'
import { ModelSelector } from './ModelSelector'
import { ThinkingSelector } from './ThinkingSelector'

interface HeaderProps {
  activeWorkspace?: Workspace
  currentModel?: { provider: string; modelId: string }
  thinkingLevel: string
  sessionStats?: { tokens?: number; cost?: number }
  onModelChange: (provider: string, modelId: string) => void
  onThinkingLevelChange: (level: string) => void
  onNewSession: () => void
}

export const Header: React.FC<HeaderProps> = ({
  activeWorkspace,
  currentModel,
  thinkingLevel,
  sessionStats,
  onModelChange,
  onThinkingLevelChange,
  onNewSession
}) => {
  const formatTokens = (tokens?: number) => {
    if (!tokens) return '0 tokens'
    if (tokens < 1000) return `${tokens} tokens`
    return `${(tokens / 1000).toFixed(1)}k tokens`
  }

  const formatCost = (cost?: number) => {
    if (!cost) return '$0.00'
    return `$${cost.toFixed(2)}`
  }

  return (
    <div className="h-14 px-4 bg-[#161b22]/70 backdrop-blur-md border-b border-[#30363d] flex items-center justify-between flex-shrink-0 z-10 titlebar-drag">
      {/* Left: Active Workspace Directory */}
      <div className="flex items-center space-x-2 truncate flex-1 min-w-0 mr-4">
        {activeWorkspace ? (
          <>
            <Folder className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-200 truncate" title={activeWorkspace.path}>
              {activeWorkspace.name}
            </span>
            <span className="text-[11px] text-gray-500 truncate max-w-[280px]" title={activeWorkspace.path}>
              ({activeWorkspace.path})
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-400">请选择或打开一个工作空间</span>
        )}
      </div>

      {/* Right: Controls (Stats, Thinking, Model, New Chat) */}
      <div className="flex items-center space-x-2.5 flex-shrink-0 titlebar-no-drag">
        {sessionStats && (
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#0d1117] border border-[#30363d] text-[11px] text-gray-400">
            <BarChart2 className="w-3 h-3 text-emerald-400" />
            <span>{formatTokens(sessionStats.tokens)}</span>
            <span className="text-gray-600">·</span>
            <span>{formatCost(sessionStats.cost)}</span>
          </div>
        )}

        {activeWorkspace && (
          <>
            <ThinkingSelector
              workspacePath={activeWorkspace.path}
              currentLevel={thinkingLevel}
              onLevelChange={onThinkingLevelChange}
            />

            <ModelSelector
              workspacePath={activeWorkspace.path}
              currentModel={currentModel}
              onModelChange={onModelChange}
            />

            <button
              onClick={onNewSession}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-sm transition-colors"
              title="新建会话"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建会话</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
