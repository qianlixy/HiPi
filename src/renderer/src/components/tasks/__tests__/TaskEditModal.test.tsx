import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskEditModal } from '../TaskEditModal'

describe('TaskEditModal component', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <TaskEditModal
        isOpen={false}
        taskToEdit={null}
        workspaces={[]}
        onClose={() => {}}
        onSave={() => {}}
      />
    )
    expect(html).toBe('')
  })

  it('renders create task dialog when taskToEdit is null', () => {
    const html = renderToStaticMarkup(
      <TaskEditModal
        isOpen={true}
        taskToEdit={null}
        workspaces={[{ id: '1', name: 'HiPi', path: '/code/hipi' }]}
        onClose={() => {}}
        onSave={() => {}}
      />
    )
    expect(html).toContain('新建任务')
    expect(html).toContain('任务标题')
    expect(html).toContain('任务描述')
    expect(html).toContain('状态')
    expect(html).toContain('优先级')
    expect(html).toContain('所属工作空间')
    expect(html).toContain('HiPi')
    expect(html).toContain('保存')
    expect(html).toContain('取消')
  })

  it('renders edit task dialog with existing values when taskToEdit is provided', () => {
    const html = renderToStaticMarkup(
      <TaskEditModal
        isOpen={true}
        taskToEdit={{
          id: '1',
          title: '已存在任务',
          description: '任务详情描述',
          status: 'in_progress',
          priority: 'urgent',
          workspacePath: '/code/hipi',
          createdAt: 100,
          updatedAt: 100
        }}
        workspaces={[{ id: '1', name: 'HiPi', path: '/code/hipi' }]}
        onClose={() => {}}
        onSave={() => {}}
      />
    )
    expect(html).toContain('编辑任务')
    expect(html).toContain('已存在任务')
    expect(html).toContain('任务详情描述')
    expect(html).toContain('value="in_progress"')
    expect(html).toContain('value="urgent"')
  })
})
