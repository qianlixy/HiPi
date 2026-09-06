import React from 'react'
import { Folder, Pencil, Trash2, GripVertical } from 'lucide-react'
import { TaskItem, TaskPriority } from '../../types'

export interface TaskCardProps {
  task: TaskItem
  workspaceName?: string
  onEdit: (task: TaskItem) => void
  onDelete: (task: TaskItem) => void
  onDragStart: (task: TaskItem) => void
}

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; badgeClass: string; dotClass: string }
> = {
  urgent: {
    label: '紧急',
    badgeClass: 'bg-red-500/15 text-red-400 border border-red-500/30',
    dotClass: 'bg-red-400'
  },
  high: {
    label: '高',
    badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    dotClass: 'bg-amber-400'
  },
  medium: {
    label: '中',
    badgeClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    dotClass: 'bg-blue-400'
  },
  low: {
    label: '低',
    badgeClass: 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
    dotClass: 'bg-gray-400'
  }
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  workspaceName,
  onEdit,
  onDelete,
  onDragStart
}) => {
  const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(task)
      }}
      className="group relative bg-[#21262d] hover:bg-[#282e37] border border-[#30363d] hover:border-[#484f58] rounded-lg p-3.5 shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing select-none"
    >
      {/* Top Header: Priority Badge & Action Icons */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${priorityInfo.badgeClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.dotClass}`} />
          <span>{priorityInfo.label}</span>
        </span>

        {/* Hover action buttons */}
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(task)
            }}
            className="p-1 rounded text-gray-400 hover:text-blue-400 hover:bg-[#30363d] transition-colors"
            title="编辑任务"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task)
            }}
            className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-[#30363d] transition-colors"
            title="删除任务"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Task Title */}
      <h4 className="text-xs font-semibold text-gray-100 leading-snug line-clamp-2 break-words mb-1.5">
        {task.title}
      </h4>

      {/* Task Description Snippet */}
      {task.description && (
        <p className="text-[11px] text-gray-400 line-clamp-2 break-words mb-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Bottom Footer: Workspace Tag & Drag Indicator */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 mt-1 border-t border-[#30363d]/60">
        {workspaceName ? (
          <span className="flex items-center space-x-1 text-gray-400 max-w-[150px] truncate">
            <Folder className="w-3 h-3 flex-shrink-0 text-gray-500" />
            <span className="truncate">{workspaceName}</span>
          </span>
        ) : (
          <span />
        )}
        <GripVertical className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />
      </div>
    </div>
  )
}
