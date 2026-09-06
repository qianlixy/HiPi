import React, { useState, useEffect, useMemo } from 'react'
import {
  TaskItem,
  TaskStatus,
  Workspace,
  CreateTaskInput,
  UpdateTaskInput
} from '../../types'
import { TaskFilterToolbar } from './TaskFilterToolbar'
import { TaskColumn } from './TaskColumn'
import { TaskEditModal } from './TaskEditModal'
import { ConfirmDialog } from '../common/ConfirmDialog'

export interface TaskManagerPanelProps {
  workspaces: Workspace[]
  activeWorkspace?: Workspace
}

const LANES: Array<{
  status: TaskStatus
  title: string
  color: 'slate' | 'blue' | 'purple' | 'emerald'
}> = [
  { status: 'todo', title: '待处理', color: 'slate' },
  { status: 'in_progress', title: '进行中', color: 'blue' },
  { status: 'review', title: '待评审', color: 'purple' },
  { status: 'done', title: '已完成', color: 'emerald' }
]

export const TaskManagerPanel: React.FC<TaskManagerPanelProps> = ({
  workspaces,
  activeWorkspace
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [filterWorkspace, setFilterWorkspace] = useState<string | undefined>(undefined)
  const [filterPriority, setFilterPriority] = useState<string | undefined>(undefined)
  const [searchKeyword, setSearchKeyword] = useState<string>('')

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const [deletingTask, setDeletingTask] = useState<TaskItem | null>(null)

  // Load tasks on mount
  const loadTasks = async () => {
    try {
      if (typeof window !== 'undefined' && window.hipiApi?.tasks?.list) {
        const list = await window.hipiApi.tasks.list()
        setTasks(list || [])
      }
    } catch (err) {
      console.error('Failed to load tasks:', err)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filter by workspace
      if (filterWorkspace && task.workspacePath !== filterWorkspace) {
        return false
      }
      // Filter by priority
      if (filterPriority && task.priority !== filterPriority) {
        return false
      }
      // Filter by keyword (case insensitive)
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase()
        const titleMatch = task.title.toLowerCase().includes(kw)
        const descMatch = (task.description || '').toLowerCase().includes(kw)
        if (!titleMatch && !descMatch) return false
      }
      return true
    })
  }, [tasks, filterWorkspace, filterPriority, searchKeyword])

  // Drag and drop handler
  const handleDropTask = async (taskId: string, targetStatus: TaskStatus) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus, updatedAt: Date.now() } : t))
    )

    try {
      if (typeof window !== 'undefined' && window.hipiApi?.tasks?.move) {
        await window.hipiApi.tasks.move(taskId, targetStatus)
      }
    } catch (err) {
      console.error('Failed to move task:', err)
      loadTasks() // Revert on failure
    }
  }

  // Save new or edited task
  const handleSaveTask = async (data: CreateTaskInput | UpdateTaskInput) => {
    try {
      if (editingTask) {
        if (typeof window !== 'undefined' && window.hipiApi?.tasks?.update) {
          const updated = await window.hipiApi.tasks.update(editingTask.id, data)
          if (updated) {
            setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? updated : t)))
          }
        }
      } else {
        if (typeof window !== 'undefined' && window.hipiApi?.tasks?.create) {
          const created = await window.hipiApi.tasks.create(data as CreateTaskInput)
          if (created) {
            setTasks((prev) => [...prev, created])
          }
        }
      }
      setEditingTask(null)
      setIsCreateModalOpen(false)
    } catch (err) {
      console.error('Failed to save task:', err)
      throw err
    }
  }

  // Delete task
  const handleConfirmDeleteTask = async () => {
    if (!deletingTask) return
    const idToDelete = deletingTask.id
    setDeletingTask(null)

    // Optimistic update
    setTasks((prev) => prev.filter((t) => t.id !== idToDelete))

    try {
      if (typeof window !== 'undefined' && window.hipiApi?.tasks?.delete) {
        await window.hipiApi.tasks.delete(idToDelete)
      }
    } catch (err) {
      console.error('Failed to delete task:', err)
      loadTasks() // Revert on failure
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#0d1117] overflow-hidden select-none">
      {/* Top Filter & Actions Toolbar */}
      <TaskFilterToolbar
        workspaces={workspaces}
        selectedWorkspacePath={filterWorkspace}
        selectedPriority={filterPriority}
        searchKeyword={searchKeyword}
        onWorkspaceChange={setFilterWorkspace}
        onPriorityChange={setFilterPriority}
        onSearchChange={setSearchKeyword}
        onNewTask={() => setIsCreateModalOpen(true)}
      />

      {/* Kanban Lanes Grid */}
      <div className="flex-1 flex gap-4 p-6 overflow-x-auto overflow-y-hidden bg-[#0d1117]">
        {LANES.map((lane) => {
          const laneTasks = filteredTasks
            .filter((t) => t.status === lane.status)
            .sort((a, b) => (a.order || 0) - (b.order || 0))

          return (
            <TaskColumn
              key={lane.status}
              status={lane.status}
              title={lane.title}
              color={lane.color}
              tasks={laneTasks}
              workspaces={workspaces}
              onEditTask={(task) => setEditingTask(task)}
              onDeleteTask={(task) => setDeletingTask(task)}
              onDragStart={() => {}}
              onDropTask={handleDropTask}
            />
          )
        })}
      </div>

      {/* Create / Edit Modal */}
      <TaskEditModal
        isOpen={isCreateModalOpen || Boolean(editingTask)}
        taskToEdit={editingTask}
        workspaces={workspaces}
        activeWorkspacePath={filterWorkspace || activeWorkspace?.path}
        onClose={() => {
          setIsCreateModalOpen(false)
          setEditingTask(null)
        }}
        onSave={handleSaveTask}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingTask)}
        title="删除任务"
        confirmText="确认删除"
        confirmVariant="danger"
        message={
          deletingTask ? (
            <div>
              <p>
                确认删除任务{' '}
                <span className="font-semibold text-gray-200">「{deletingTask.title}」</span> 吗？
              </p>
              <p className="text-red-400/90 text-xs mt-2">
                此操作将从本地持久化存储中物理移除该任务，不可恢复。
              </p>
            </div>
          ) : null
        }
        onConfirm={handleConfirmDeleteTask}
        onCancel={() => setDeletingTask(null)}
      />
    </div>
  )
}
