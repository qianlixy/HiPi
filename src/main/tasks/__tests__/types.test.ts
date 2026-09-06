import { describe, it, expect } from 'vitest'
import { TaskItem, TASK_STATUSES, TASK_PRIORITIES } from '../types'

describe('Task types and validation constants', () => {
  it('defines valid statuses and priorities', () => {
    expect(TASK_STATUSES).toEqual(['todo', 'in_progress', 'review', 'done'])
    expect(TASK_PRIORITIES).toEqual(['urgent', 'high', 'medium', 'low'])
  })

  it('allows constructing a valid TaskItem object', () => {
    const task: TaskItem = {
      id: 'task-123',
      title: '实现视窗架构',
      description: '挂载 TaskManagerPanel',
      status: 'todo',
      priority: 'high',
      workspacePath: '/path/to/project',
      order: 0,
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    }
    expect(task.id).toBe('task-123')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('high')
  })
})
