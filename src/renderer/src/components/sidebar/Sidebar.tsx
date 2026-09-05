import React from 'react'
import { FolderPlus, Settings, Sparkles, RefreshCw } from 'lucide-react'
import { Workspace, SessionSummary, PiRuntimeStatus } from '../../types'
import { WorkspaceGroup } from './WorkspaceGroup'
import { SidebarQuickNav } from './SidebarQuickNav'

interface SidebarProps {
  workspaces: Workspace[]
  activeWorkspace?: Workspace
  sessions: SessionSummary[]
  activeSessionId?: string
  streamingMap?: Record<string, boolean>
  runtimeStatus: PiRuntimeStatus | null
  onOpenFolderDialog: () => void
  onSelectWorkspace: (ws: Workspace) => void
  onSelectSession: (ws: Workspace, session: SessionSummary) => void
  onNewSession: (ws: Workspace) => void
  onDeleteSession: (session: SessionSummary) => void
  onRemoveWorkspace: (ws: Workspace) => void
  onOpenSettings: () => void
  onQuickAction?: (actionId: string, label: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  workspaces,
  activeWorkspace,
  sessions,
  activeSessionId,
  streamingMap,
  runtimeStatus,
  onOpenFolderDialog,
  onSelectWorkspace,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRemoveWorkspace,
  onOpenSettings,
  onQuickAction
}) => {
  return (
    <div className="w-64 h-full flex flex-col bg-[#0d1117] border-r border-[#30363d] select-none">
      {/* Top Header - pl-20 reserves space for macOS traffic light buttons (close/minimize/maximize) */}
      <div className="h-14 pl-20 pr-3 flex items-center justify-between border-b border-[#30363d] flex-shrink-0 titlebar-drag">
        <div className="flex items-center space-x-2 truncate">
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-[11px] shadow-sm flex-shrink-0">
            π
          </div>
          <span className="font-semibold text-xs text-gray-100 tracking-wide truncate">HiPi</span>
        </div>

        <button
          onClick={onOpenFolderDialog}
          className="p-1.5 rounded-md hover:bg-[#21262d] text-gray-400 hover:text-white transition-colors titlebar-no-drag flex-shrink-0 ml-1"
          title="打开代码工程目录"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Navigation Hub */}
      <SidebarQuickNav onAction={onQuickAction} />

      {/* Workspace & Sessions List */}
      <div className="flex-1 overflow-y-auto p-2">
        {workspaces.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500">
            <Sparkles className="w-8 h-8 mb-2 opacity-30 text-accent" />
            <p className="text-xs font-medium text-gray-400">尚未打开工作空间</p>
            <p className="text-[11px] mt-1 text-gray-500">点击上方按钮或下方添加工程文件夹开始编程</p>
            <button
              onClick={onOpenFolderDialog}
              className="mt-4 px-3 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-xs text-accent font-medium border border-[#30363d] transition-all"
            >
              + 打开文件夹
            </button>
          </div>
        ) : (
          workspaces.map((ws) => {
            const wsSessions = sessions.filter(
              (s) => s.workspacePath === ws.path || s.workspacePath.endsWith(ws.name)
            )
            return (
              <WorkspaceGroup
                key={ws.path}
                workspace={ws}
                isActive={activeWorkspace?.path === ws.path}
                sessions={wsSessions}
                activeSessionId={activeSessionId}
                streamingMap={streamingMap}
                onSelectWorkspace={onSelectWorkspace}
                onSelectSession={onSelectSession}
                onNewSession={onNewSession}
                onDeleteSession={onDeleteSession}
                onRemoveWorkspace={onRemoveWorkspace}
              />
            )
          })
        )}
      </div>

      {/* Bottom Status & Settings Bar */}
      <div className="h-12 px-3 border-t border-[#30363d] flex items-center justify-between text-xs text-gray-400 bg-[#161b22]/50 flex-shrink-0">
        <div className="flex items-center space-x-2 truncate">
          <span
            className={`w-2 h-2 rounded-full ${
              runtimeStatus?.isUpdating
                ? 'bg-yellow-400 animate-pulse'
                : runtimeStatus?.installed
                ? 'bg-emerald-400'
                : 'bg-red-500'
            }`}
          />
          <span className="text-[11px] truncate">
            {runtimeStatus?.isUpdating ? (
              <span className="flex items-center space-x-1 text-yellow-400">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                <span>升级中...</span>
              </span>
            ) : runtimeStatus?.installed ? (
              <span>pi {runtimeStatus.version || 'ready'}</span>
            ) : (
              <span className="text-red-400">PI 未就绪</span>
            )}
          </span>
        </div>

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded hover:bg-[#21262d] text-gray-400 hover:text-white transition-colors"
          title="设置与 API 密钥"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
