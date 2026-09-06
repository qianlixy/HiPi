import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskManagerPanel } from '../TaskManagerPanel'

describe('TaskManagerPanel component', () => {
  beforeEach(() => {
    // Mock window.hipiApi.tasks
    const win = ((globalThis as any).window = (globalThis as any).window || {})
    win.hipiApi = {
      tasks: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        move: vi.fn()
      }
    }
  })

  it('renders all 4 Kanban status columns: 待处理, 进行中, 待评审, 已完成', () => {
    const html = renderToStaticMarkup(
      <TaskManagerPanel
        workspaces={[{ id: '1', name: 'HiPi', path: '/code/hipi' }]}
        activeWorkspace={{ id: '1', name: 'HiPi', path: '/code/hipi' }}
      />
    )
    expect(html).toContain('待处理')
    expect(html).toContain('进行中')
    expect(html).toContain('待评审')
    expect(html).toContain('已完成')
  })

  it('renders filter toolbar and new task button', () => {
    const html = renderToStaticMarkup(
      <TaskManagerPanel
        workspaces={[{ id: '1', name: 'HiPi', path: '/code/hipi' }]}
        activeWorkspace={{ id: '1', name: 'HiPi', path: '/code/hipi' }}
      />
    )
    expect(html).toContain('全部工作空间')
    expect(html).toContain('全部优先级')
    expect(html).toContain('新建任务')
  })
})
