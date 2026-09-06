import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskColumn } from '../TaskColumn'
import { TaskItem } from '../../../types'

describe('TaskColumn component', () => {
  const sampleTasks: TaskItem[] = [
    {
      id: 't-1',
      title: '任务一',
      status: 'todo',
      priority: 'high',
      createdAt: 1000,
      updatedAt: 1000
    },
    {
      id: 't-2',
      title: '任务二',
      status: 'todo',
      priority: 'medium',
      createdAt: 1001,
      updatedAt: 1001
    }
  ]

  it('renders column title, task count badge, and task cards', () => {
    const html = renderToStaticMarkup(
      <TaskColumn
        status="todo"
        title="待处理"
        color="slate"
        tasks={sampleTasks}
        workspaces={[]}
        onEditTask={() => {}}
        onDeleteTask={() => {}}
        onDragStart={() => {}}
        onDropTask={() => {}}
      />
    )
    expect(html).toContain('待处理')
    expect(html).toContain('2')
    expect(html).toContain('任务一')
    expect(html).toContain('任务二')
  })

  it('renders empty placeholder when no tasks', () => {
    const html = renderToStaticMarkup(
      <TaskColumn
        status="in_progress"
        title="进行中"
        color="blue"
        tasks={[]}
        workspaces={[]}
        onEditTask={() => {}}
        onDeleteTask={() => {}}
        onDragStart={() => {}}
        onDropTask={() => {}}
      />
    )
    expect(html).toContain('进行中')
    expect(html).toContain('0')
    expect(html).toContain('暂无任务')
  })
})
