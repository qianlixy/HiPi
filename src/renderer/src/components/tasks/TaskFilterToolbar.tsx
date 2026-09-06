import React from 'react'
import { Plus, Search, Folder, Flag } from 'lucide-react'
import { Workspace } from '../../types'

export interface TaskFilterToolbarProps {
  workspaces: Workspace[]
  selectedWorkspacePath?: string
  selectedPriority?: string
  searchKeyword: string
  onWorkspaceChange: (path?: string) => void
  onPriorityChange: (priority?: string) => void
  onSearchChange: (keyword: string) => void
  onNewTask: () => void
}

export const TaskFilterToolbar: React.FC<TaskFilterToolbarProps> = ({
  workspaces,
  selectedWorkspacePath,
  selectedPriority,
  searchKeyword,
  onWorkspaceChange,
  onPriorityChange,
  onSearchChange,
  onNewTask
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-[#30363d] bg-[#161b22]/70 backdrop-blur-sm">
      {/* Left: Filter Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Workspace Filter */}
        <div className="relative flex items-center">
          <Folder className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
          <select
            value={selectedWorkspacePath || ''}
            onChange={(e) => onWorkspaceChange(e.target.value || undefined)}
            className="pl-8 pr-7 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-md text-xs text-gray-200 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer hover:bg-[#21262d] transition-colors"
          >
            <option value="">全部工作空间</option>
            {workspaces.map((ws) => (
              <option key={ws.path} value={ws.path}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div className="relative flex items-center">
          <Flag className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
          <select
            value={selectedPriority || ''}
            onChange={(e) => onPriorityChange(e.target.value || undefined)}
            className="pl-8 pr-7 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-md text-xs text-gray-200 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer hover:bg-[#21262d] transition-colors"
          >
            <option value="">全部优先级</option>
            <option value="urgent">🔴 紧急 (Urgent)</option>
            <option value="high">🟠 高 (High)</option>
            <option value="medium">🔵 中 (Medium)</option>
            <option value="low">⚪ 低 (Low)</option>
          </select>
        </div>

        {/* Keyword Search */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索任务..."
            className="pl-8 pr-3 py-1.5 w-44 sm:w-56 bg-[#0d1117] border border-[#30363d] rounded-md text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Right: New Task Action */}
      <div className="flex items-center">
        <button
          onClick={onNewTask}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建任务</span>
        </button>
      </div>
    </div>
  )
}
