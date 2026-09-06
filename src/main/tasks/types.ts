export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'

export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
export const TASK_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low']

export interface TaskStep {
  id: string
  title: string
  completed: boolean
}

export interface TaskItem {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  workspacePath?: string
  order?: number
  createdAt: number
  updatedAt: number
  sessionId?: string
  steps?: TaskStep[]
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  workspacePath?: string
  order?: number
  sessionId?: string
  steps?: TaskStep[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  workspacePath?: string
  order?: number
  sessionId?: string
  steps?: TaskStep[]
}
