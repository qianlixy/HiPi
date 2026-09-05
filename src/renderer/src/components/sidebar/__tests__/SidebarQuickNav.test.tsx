import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SidebarQuickNav, getQuickNavItems } from '../SidebarQuickNav'

describe('SidebarQuickNav Component', () => {
  it('renders quick action buttons: 新建会话 and 任务列表', () => {
    const html = renderToStaticMarkup(<SidebarQuickNav onAction={() => {}} />)
    expect(html).toContain('新建会话')
    expect(html).toContain('任务列表')
  })

  it('renders the shortcut tag ⌘N for new session', () => {
    const html = renderToStaticMarkup(<SidebarQuickNav onAction={() => {}} />)
    expect(html).toContain('⌘N')
  })

  it('renders section title 工作空间', () => {
    const html = renderToStaticMarkup(<SidebarQuickNav onAction={() => {}} />)
    expect(html).toContain('工作空间')
  })

  it('getQuickNavItems config triggers onAction callback for new-session', () => {
    const handleAction = vi.fn()
    const items = getQuickNavItems(handleAction)
    const newSessionItem = items.find((i) => i.id === 'new-session')

    expect(newSessionItem).toBeDefined()
    expect(newSessionItem?.label).toBe('新建会话')
    expect(newSessionItem?.shortcut).toBe('⌘N')

    newSessionItem?.onClick()
    expect(handleAction).toHaveBeenCalledWith('new-session', '新建会话')
  })

  it('getQuickNavItems config triggers onAction callback for task-list', () => {
    const handleAction = vi.fn()
    const items = getQuickNavItems(handleAction)
    const taskListItem = items.find((i) => i.id === 'task-list')

    expect(taskListItem).toBeDefined()
    expect(taskListItem?.label).toBe('任务列表')

    taskListItem?.onClick()
    expect(handleAction).toHaveBeenCalledWith('task-list', '任务列表')
  })
})
