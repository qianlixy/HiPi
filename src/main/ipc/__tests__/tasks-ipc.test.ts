import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers: Record<string, Function> = {}

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      handlers[channel] = handler
    })
  },
  dialog: {
    showOpenDialog: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  }
}))

import { registerIpcHandlers } from '../register-handlers'
import { TaskStore } from '../../tasks/task-store'

describe('Tasks IPC registration', () => {
  let mockTaskStore: any

  beforeEach(() => {
    for (const key of Object.keys(handlers)) {
      delete handlers[key]
    }
    mockTaskStore = {
      list: vi.fn().mockReturnValue([{ id: '1', title: 'Task 1' }]),
      create: vi.fn().mockImplementation((input) => ({ id: '2', ...input })),
      update: vi.fn().mockImplementation((id, updates) => ({ id, ...updates })),
      delete: vi.fn().mockReturnValue(true),
      move: vi.fn().mockReturnValue({ id: '1', status: 'done' })
    }
  })

  it('registers tasks:* channels and delegates to taskStore', async () => {
    const mockRuntime = { ensureRuntime: vi.fn() } as any
    const mockSessionMgr = { onEvent: vi.fn() } as any
    const mockScanner = {} as any
    const mockSettings = { getSettings: vi.fn().mockReturnValue({}) } as any

    registerIpcHandlers(
      () => null,
      mockRuntime,
      mockSessionMgr,
      mockScanner,
      mockSettings,
      mockTaskStore
    )

    expect(handlers['tasks:list']).toBeDefined()
    expect(handlers['tasks:create']).toBeDefined()
    expect(handlers['tasks:update']).toBeDefined()
    expect(handlers['tasks:delete']).toBeDefined()
    expect(handlers['tasks:move']).toBeDefined()

    // Test list
    const listRes = await handlers['tasks:list']()
    expect(listRes).toEqual([{ id: '1', title: 'Task 1' }])
    expect(mockTaskStore.list).toHaveBeenCalled()

    // Test create
    const createRes = await handlers['tasks:create'](null, { title: 'New Task' })
    expect(createRes).toEqual({ id: '2', title: 'New Task' })
    expect(mockTaskStore.create).toHaveBeenCalledWith({ title: 'New Task' })

    // Test update
    const updateRes = await handlers['tasks:update'](null, { id: '1', updates: { title: 'Updated' } })
    expect(updateRes).toEqual({ id: '1', title: 'Updated' })
    expect(mockTaskStore.update).toHaveBeenCalledWith('1', { title: 'Updated' })

    // Test delete
    const deleteRes = await handlers['tasks:delete'](null, '1')
    expect(deleteRes).toBe(true)
    expect(mockTaskStore.delete).toHaveBeenCalledWith('1')

    // Test move
    const moveRes = await handlers['tasks:move'](null, { id: '1', status: 'done', newIndex: 0 })
    expect(moveRes).toEqual({ id: '1', status: 'done' })
    expect(mockTaskStore.move).toHaveBeenCalledWith('1', 'done', 0)
  })
})
