import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConfirmDialog } from '../ConfirmDialog'

describe('ConfirmDialog component', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        isOpen={false}
        title="确认删除"
        message="确定要删除吗？"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(html).toBe('')
  })

  it('renders modal with title, message and default button texts when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        isOpen={true}
        title="删除会话"
        message="确认删除该会话吗？此操作不可恢复。"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(html).toContain('删除会话')
    expect(html).toContain('确认删除该会话吗？此操作不可恢复。')
    expect(html).toContain('确认')
    expect(html).toContain('取消')
  })

  it('renders custom confirmText and cancelText', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        isOpen={true}
        title="提示"
        message="测试内容"
        confirmText="立即移除"
        cancelText="稍后再说"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(html).toContain('立即移除')
    expect(html).toContain('稍后再说')
  })

  it('renders danger styles when confirmVariant is danger', () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        isOpen={true}
        title="危险操作"
        message="危险提示"
        confirmVariant="danger"
        confirmText="确认删除"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(html).toContain('bg-red-600')
  })
})
