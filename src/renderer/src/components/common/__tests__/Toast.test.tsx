import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Toast, createToastTimer } from '../Toast'

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders empty markup when message is null', () => {
    const html = renderToStaticMarkup(<Toast message={null} onClose={() => {}} />)
    expect(html).toBe('')
  })

  it('renders message text and alert/sparkles icon when message is provided', () => {
    const html = renderToStaticMarkup(<Toast message="敬请期待" onClose={() => {}} />)
    expect(html).toContain('敬请期待')
    expect(html).toContain('role="status"')
  })

  it('triggers callback via createToastTimer after duration', () => {
    const handleClose = vi.fn()
    const timer = createToastTimer(handleClose, 2000)

    expect(handleClose).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1999)
    expect(handleClose).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(handleClose).toHaveBeenCalledTimes(1)

    timer.clear()
  })

  it('allows canceling timer via clear()', () => {
    const handleClose = vi.fn()
    const timer = createToastTimer(handleClose, 1000)

    timer.clear()
    vi.advanceTimersByTime(1500)
    expect(handleClose).not.toHaveBeenCalled()
  })
})
