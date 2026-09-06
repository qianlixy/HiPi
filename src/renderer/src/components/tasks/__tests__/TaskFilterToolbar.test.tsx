import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskFilterToolbar } from '../TaskFilterToolbar'

describe('TaskFilterToolbar component', () => {
  const sampleWorkspaces = [
    { id: '1', name: 'HiPi Client', path: '/code/hipi' },
    { id: '2', name: 'Pi Runtime', path: '/code/pi' }
  ]

  it('renders filter controls and new task button', () => {
    const html = renderToStaticMarkup(
      <TaskFilterToolbar
        workspaces={sampleWorkspaces}
        selectedWorkspacePath={undefined}
        selectedPriority={undefined}
        searchKeyword=""
        onWorkspaceChange={() => {}}
        onPriorityChange={() => {}}
        onSearchChange={() => {}}
        onNewTask={() => {}}
      />
    )
    expect(html).toContain('全部工作空间')
    expect(html).toContain('全部优先级')
    expect(html).toContain('搜索任务...')
    expect(html).toContain('新建任务')
    expect(html).toContain('HiPi Client')
    expect(html).toContain('Pi Runtime')
  })

  it('renders with selected workspace and priority', () => {
    const html = renderToStaticMarkup(
      <TaskFilterToolbar
        workspaces={sampleWorkspaces}
        selectedWorkspacePath="/code/hipi"
        selectedPriority="urgent"
        searchKeyword="测试关键字"
        onWorkspaceChange={() => {}}
        onPriorityChange={() => {}}
        onSearchChange={() => {}}
        onNewTask={() => {}}
      />
    )
    expect(html).toContain('value="/code/hipi"')
    expect(html).toContain('value="urgent"')
    expect(html).toContain('value="测试关键字"')
  })
})
