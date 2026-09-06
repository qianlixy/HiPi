import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  TaskItem,
  TaskStatus,
  TaskPriority,
  Workspace,
  CreateTaskInput,
  UpdateTaskInput
} from '../../types'

export interface TaskEditModalProps {
  isOpen: boolean
  taskToEdit?: TaskItem | null
  defaultStatus?: TaskStatus
  workspaces: Workspace[]
  activeWorkspacePath?: string
  onClose: () => void
  onSave: (data: CreateTaskInput | UpdateTaskInput) => Promise<void> | void
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  isOpen,
  taskToEdit,
  defaultStatus = 'todo',
  workspaces,
  activeWorkspacePath,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState(taskToEdit?.title || '')
  const [description, setDescription] = useState(taskToEdit?.description || '')
  const [status, setStatus] = useState<TaskStatus>(taskToEdit?.status || defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>(taskToEdit?.priority || 'medium')
  const [workspacePath, setWorkspacePath] = useState<string | undefined>(
    taskToEdit?.workspacePath || activeWorkspacePath
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title)
      setDescription(taskToEdit.description || '')
      setStatus(taskToEdit.status)
      setPriority(taskToEdit.priority)
      setWorkspacePath(taskToEdit.workspacePath)
    } else {
      setTitle('')
      setDescription('')
      setStatus(defaultStatus)
      setPriority('medium')
      setWorkspacePath(activeWorkspacePath)
    }
    setError(null)
    setIsSaving(false)
  }, [taskToEdit, defaultStatus, activeWorkspacePath, isOpen])

  if (!isOpen) return null

  const isEditing = Boolean(taskToEdit)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('请输入任务标题')
      return
    }

    try {
      setIsSaving(true)
      await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        workspacePath: workspacePath || undefined
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || '保存任务失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
          <h3 className="text-sm font-semibold text-gray-100">
            {isEditing ? '编辑任务' : '新建任务'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              任务标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (error) setError(null)
              }}
              placeholder="例如：视窗集成与任务看板架构"
              className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] focus:border-blue-500 focus:outline-none rounded-md text-xs text-gray-100 placeholder-gray-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">任务描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="详细补充任务范围、参考步骤或注意事项..."
              className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] focus:border-blue-500 focus:outline-none rounded-md text-xs text-gray-100 placeholder-gray-500 resize-none leading-relaxed"
            />
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-1.5 bg-[#0d1117] border border-[#30363d] focus:border-blue-500 focus:outline-none rounded-md text-xs text-gray-200 cursor-pointer"
              >
                <option value="todo">待处理 (Todo)</option>
                <option value="in_progress">进行中 (In Progress)</option>
                <option value="review">待评审 (Review)</option>
                <option value="done">已完成 (Done)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">优先级</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-1.5 bg-[#0d1117] border border-[#30363d] focus:border-blue-500 focus:outline-none rounded-md text-xs text-gray-200 cursor-pointer"
              >
                <option value="urgent">🔴 紧急 (Urgent)</option>
                <option value="high">🟠 高 (High)</option>
                <option value="medium">🔵 中 (Medium)</option>
                <option value="low">⚪ 低 (Low)</option>
              </select>
            </div>
          </div>

          {/* Workspace */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">所属工作空间</label>
            <select
              value={workspacePath || ''}
              onChange={(e) => setWorkspacePath(e.target.value || undefined)}
              className="w-full px-3 py-1.5 bg-[#0d1117] border border-[#30363d] focus:border-blue-500 focus:outline-none rounded-md text-xs text-gray-200 cursor-pointer"
            >
              <option value="">(无归属 / 全局任务)</option>
              {workspaces.map((ws) => (
                <option key={ws.path} value={ws.path}>
                  {ws.name} ({ws.path})
                </option>
              ))}
            </select>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
