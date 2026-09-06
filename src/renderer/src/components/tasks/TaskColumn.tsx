import React, { useState } from 'react'
import { TaskItem, TaskStatus, Workspace } from '../../types'
import { TaskCard } from './TaskCard'

export interface TaskColumnProps {
  status: TaskStatus
  title: string
  color: 'slate' | 'blue' | 'purple' | 'emerald'
  tasks: TaskItem[]
  workspaces: Workspace[]
  onEditTask: (task: TaskItem) => void
  onDeleteTask: (task: TaskItem) => void
  onDragStart: (task: TaskItem) => void
  onDropTask: (taskId: string, targetStatus: TaskStatus) => void
}

const COLOR_CLASSES: Record<
  TaskColumnProps['color'],
  { dot: string; headerBadge: string; activeBorder: string }
> = {
  slate: {
    dot: 'bg-slate-400',
    headerBadge: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    activeBorder: 'border-slate-500/50 bg-slate-500/5'
  },
  blue: {
    dot: 'bg-blue-400',
    headerBadge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    activeBorder: 'border-blue-500/50 bg-blue-500/5'
  },
  purple: {
    dot: 'bg-purple-400',
    headerBadge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    activeBorder: 'border-purple-500/50 bg-purple-500/5'
  },
  emerald: {
    dot: 'bg-emerald-400',
    headerBadge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    activeBorder: 'border-emerald-500/50 bg-emerald-500/5'
  }
}

export const TaskColumn: React.FC<TaskColumnProps> = ({
  status,
  title,
  color,
  tasks,
  workspaces,
  onEditTask,
  onDeleteTask,
  onDragStart,
  onDropTask
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const styling = COLOR_CLASSES[color] || COLOR_CLASSES.slate

  const workspaceMap = new Map(workspaces.map((w) => [w.path, w.name]))

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) {
      onDropTask(taskId, status)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 min-w-[260px] flex flex-col bg-[#161b22] border rounded-xl p-3 transition-colors ${
        isDragOver
          ? styling.activeBorder + ' ring-2 ring-blue-500/40'
          : 'border-[#30363d]'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#30363d]/70 select-none">
        <div className="flex items-center space-x-2">
          <span className={`w-2.5 h-2.5 rounded-full ${styling.dot}`} />
          <h3 className="text-xs font-semibold text-gray-200 tracking-wide">{title}</h3>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${styling.headerBadge}`}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task Cards Container */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 custom-scrollbar min-h-[140px]">
        {tasks.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center border border-dashed border-[#30363d] rounded-lg text-center p-3 select-none">
            <p className="text-xs text-gray-500">暂无任务</p>
            <p className="text-[10px] text-gray-600 mt-0.5">可将其他卡片拖拽至此</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              workspaceName={task.workspacePath ? workspaceMap.get(task.workspacePath) : undefined}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  )
}
