import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SessionItem } from '../SessionItem'
import { WorkspaceGroup } from '../WorkspaceGroup'
import { SessionSummary, Workspace } from '../../../types'

describe('SessionItem component', () => {
  const mockSession: SessionSummary = {
    id: 'test-sess-1',
    path: '/path/to/test.jsonl',
    workspacePath: '/workspace',
    name: '测试会话',
    timestamp: Date.now()
  }

  it('renders session item without streaming indicator when isStreaming is false', () => {
    const html = renderToStaticMarkup(
      <SessionItem
        session={mockSession}
        isActive={false}
        isStreaming={false}
        onSelect={() => {}}
        onDelete={() => {}}
      />
    )
    expect(html).toContain('测试会话')
    expect(html).not.toContain('session-streaming-indicator')
  })

  it('renders breathing running indicator when isStreaming is true', () => {
    const html = renderToStaticMarkup(
      <SessionItem
        session={mockSession}
        isActive={true}
        isStreaming={true}
        onSelect={() => {}}
        onDelete={() => {}}
      />
    )
    expect(html).toContain('测试会话')
    expect(html).toContain('session-streaming-indicator')
    expect(html).toContain('animate-ping')
  })
})

describe('WorkspaceGroup component', () => {
  const mockWorkspace: Workspace = {
    id: 'ws-1',
    name: '测试工作区',
    path: '/path/to/workspace'
  }

  const mockSessions: SessionSummary[] = [
    {
      id: 'sess-1',
      path: '/path/to/sess-1.jsonl',
      workspacePath: '/path/to/workspace',
      name: '会话1',
      timestamp: Date.now()
    }
  ]

  it('renders workspace group without indicator when no sessions are streaming', () => {
    const html = renderToStaticMarkup(
      <WorkspaceGroup
        workspace={mockWorkspace}
        isActive={true}
        sessions={mockSessions}
        streamingMap={{ 'sess-1': false }}
        onSelectWorkspace={() => {}}
        onSelectSession={() => {}}
        onNewSession={() => {}}
        onDeleteSession={() => {}}
        onRemoveWorkspace={() => {}}
      />
    )
    expect(html).toContain('测试工作区')
    expect(html).not.toContain('workspace-streaming-indicator')
  })

  it('renders workspace group with breathing indicator when child session is streaming', () => {
    const html = renderToStaticMarkup(
      <WorkspaceGroup
        workspace={mockWorkspace}
        isActive={true}
        sessions={mockSessions}
        streamingMap={{ 'sess-1': true }}
        onSelectWorkspace={() => {}}
        onSelectSession={() => {}}
        onNewSession={() => {}}
        onDeleteSession={() => {}}
        onRemoveWorkspace={() => {}}
      />
    )
    expect(html).toContain('测试工作区')
    expect(html).toContain('workspace-streaming-indicator')
    expect(html).toContain('animate-ping')
  })

  it('renders workspace group with breathing indicator when default workspace session is streaming', () => {
    const html = renderToStaticMarkup(
      <WorkspaceGroup
        workspace={mockWorkspace}
        isActive={true}
        sessions={mockSessions}
        streamingMap={{ [`${mockWorkspace.path}::__default__`]: true }}
        onSelectWorkspace={() => {}}
        onSelectSession={() => {}}
        onNewSession={() => {}}
        onDeleteSession={() => {}}
        onRemoveWorkspace={() => {}}
      />
    )
    expect(html).toContain('测试工作区')
    expect(html).toContain('workspace-streaming-indicator')
    expect(html).toContain('animate-ping')
  })
})
