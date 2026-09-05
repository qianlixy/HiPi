import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownLink, handleLinkClick } from '../MessageItem'
import { MessageItem } from '../MessageItem'
import { ChatMessage } from '../../../types'

describe('MessageItem Link Component & Interaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders MarkdownLink with correct attributes and CSS classes', () => {
    const html = renderToStaticMarkup(
      <MarkdownLink href="https://github.com/qianlixy/hipi">
        GitHub Repository
      </MarkdownLink>
    )

    expect(html).toContain('href="https://github.com/qianlixy/hipi"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('title="https://github.com/qianlixy/hipi"')
    expect(html).toContain('text-[#58a6ff]')
    expect(html).toContain('hover:text-[#79c0ff]')
    expect(html).toContain('hover:underline')
    expect(html).toContain('GitHub Repository')
  })

  it('handleLinkClick calls preventDefault and window.hipiApi.system.openExternal', () => {
    const preventDefault = vi.fn()
    const mockOpenExternal = vi.fn().mockResolvedValue(true)
    const win = ((globalThis as any).window = (globalThis as any).window || {})
    const originalHipiApi = win.hipiApi

    win.hipiApi = {
      system: {
        openExternal: mockOpenExternal
      }
    }

    const mockEvent = {
      preventDefault
    } as unknown as React.MouseEvent<HTMLAnchorElement>

    handleLinkClick(mockEvent, 'https://example.com')

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com')

    win.hipiApi = originalHipiApi
  })

  it('handleLinkClick falls back to window.open if hipiApi is absent', () => {
    const preventDefault = vi.fn()
    const mockWindowOpen = vi.fn()
    const win = ((globalThis as any).window = (globalThis as any).window || {})
    const originalHipiApi = win.hipiApi
    const originalWindowOpen = win.open

    delete win.hipiApi
    win.open = mockWindowOpen

    const mockEvent = {
      preventDefault
    } as unknown as React.MouseEvent<HTMLAnchorElement>

    handleLinkClick(mockEvent, 'https://fallback.com')

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(mockWindowOpen).toHaveBeenCalledWith('https://fallback.com', '_blank', 'noopener,noreferrer')

    win.hipiApi = originalHipiApi
    win.open = originalWindowOpen
  })

  it('renders full message containing markdown link properly', () => {
    const message: ChatMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: '请查看官方文档：[文档链接](https://docs.example.com)',
      timestamp: Date.now()
    }

    const html = renderToStaticMarkup(<MessageItem message={message} />)
    expect(html).toContain('href="https://docs.example.com"')
    expect(html).toContain('文档链接')
    expect(html).toContain('title="https://docs.example.com"')
  })
})
