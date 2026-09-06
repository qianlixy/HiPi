import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Sidebar } from '../Sidebar'

describe('Sidebar Component with QuickNav', () => {
  const defaultProps = {
    workspaces: [],
    sessions: [],
    runtimeStatus: null,
    onOpenFolderDialog: vi.fn(),
    onSelectWorkspace: vi.fn(),
    onSelectSession: vi.fn(),
    onNewSession: vi.fn(),
    onDeleteSession: vi.fn(),
    onRemoveWorkspace: vi.fn(),
    onOpenSettings: vi.fn()
  }

  it('renders quick nav entries in sidebar', () => {
    const html = renderToStaticMarkup(<Sidebar {...defaultProps} />)
    expect(html).toContain('新建会话')
    expect(html).toContain('任务看板')
    expect(html).toContain('⌘N')
    expect(html).toContain('工作空间')
  })
})
