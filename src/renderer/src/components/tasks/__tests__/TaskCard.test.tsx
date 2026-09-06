import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskCard } from '../TaskCard'
import { TaskItem } from '../../../types'

describe('TaskCard component', () => {
  const sampleTask: TaskItem = {
    id: 't-1',
    title: '实现泳道拖拽',
    description: '支持 HTML5 drag and drop',
    status: 'todo',
    priority: 'urgent',
    workspacePath: '/code/hipi',
    createdAt: 1000,
    updatedAt: 1000
  }

  it('renders task title, description and urgent priority badge', () => {
    const html = renderToStaticMarkup(
      <TaskCard
        task={sampleTask}
        workspaceName="HiPi"
        onEdit={() => {}}
        onDelete={() => {}}
        onDragStart={() => {}}
      />
    )
    expect(html).toContain('实现泳道拖拽')
    expect(html).toContain('支持 HTML5 drag and drop')
    expect(html).toContain('紧急')
    expect(html).toContain('HiPi')
    expect(html).toContain('draggable="true"')
  })

  it('renders correctly without description and workspace', () => {
    const simpleTask: TaskItem = {
      id: 't-2',
      title: '简单任务',
      status: 'done',
      priority: 'low',
      createdAt: 1000,
      updatedAt: 1000
    }
    const html = renderToStaticMarkup(
      <TaskCard
        task={simpleTask}
        onEdit={() => {}}
        onDelete={() => {}}
        onDragStart={() => {}}
      />
    )
    expect(html).toContain('简单任务')
    expect(html).toContain('低')
  })
})
