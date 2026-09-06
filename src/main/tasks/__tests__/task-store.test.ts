import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { TaskStore } from '../task-store'

describe('TaskStore persistence', () => {
  let tempDir: string
  let tasksFile: string
  let store: TaskStore

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hipi-test-tasks-'))
    tasksFile = path.join(tempDir, 'tasks.json')
    store = new TaskStore(tasksFile)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('initializes with empty list when file does not exist', () => {
    expect(store.list()).toEqual([])
  })

  it('creates, reads and updates tasks with timestamp', () => {
    const task = store.create({
      title: '编写单测',
      priority: 'high',
      status: 'todo'
    })
    expect(task.id).toBeDefined()
    expect(task.title).toBe('编写单测')
    expect(task.priority).toBe('high')
    expect(task.status).toBe('todo')
    expect(task.createdAt).toBeGreaterThan(0)
    expect(store.list()).toHaveLength(1)

    const updated = store.update(task.id, { title: '编写完整单测', status: 'in_progress' })
    expect(updated?.title).toBe('编写完整单测')
    expect(updated?.status).toBe('in_progress')
    expect(store.getById(task.id)?.title).toBe('编写完整单测')
  })

  it('deletes task and persists to disk', () => {
    const task = store.create({ title: '待删除任务' })
    expect(store.list()).toHaveLength(1)
    const success = store.delete(task.id)
    expect(success).toBe(true)
    expect(store.list()).toHaveLength(0)

    // Verify disk state
    const newStore = new TaskStore(tasksFile)
    expect(newStore.list()).toHaveLength(0)
  })

  it('moves task to new status lane with order adjustment', () => {
    const t1 = store.create({ title: '任务1', status: 'todo' })
    const t2 = store.create({ title: '任务2', status: 'todo' })

    const moved = store.move(t1.id, 'done', 0)
    expect(moved?.status).toBe('done')
    expect(store.getById(t1.id)?.status).toBe('done')
    expect(store.getById(t2.id)?.status).toBe('todo')
  })

  it('handles corrupted JSON gracefully without crashing', () => {
    fs.writeFileSync(tasksFile, '{ not valid json }', 'utf8')
    const corruptedStore = new TaskStore(tasksFile)
    expect(corruptedStore.list()).toEqual([])
  })
})
