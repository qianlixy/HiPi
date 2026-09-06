import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { TaskItem, TaskStatus, CreateTaskInput, UpdateTaskInput } from './types'

export class TaskStore {
  private filePath: string
  private tasks: TaskItem[] = []

  constructor(customFilePath?: string) {
    if (customFilePath) {
      this.filePath = customFilePath
    } else {
      const configDir = path.join(os.homedir(), '.hipi')
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      this.filePath = path.join(configDir, 'tasks.json')
    }
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8')
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          this.tasks = parsed
          return
        }
      }
    } catch (err) {
      console.error('[TaskStore] Failed to load tasks from disk:', err)
    }
    this.tasks = []
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.tasks, null, 2), 'utf8')
    } catch (err) {
      console.error('[TaskStore] Failed to save tasks to disk:', err)
    }
  }

  public list(): TaskItem[] {
    return [...this.tasks]
  }

  public getById(id: string): TaskItem | null {
    return this.tasks.find((t) => t.id === id) || null
  }

  public create(input: CreateTaskInput): TaskItem {
    const now = Date.now()
    const laneTasks = this.tasks.filter((t) => t.status === (input.status || 'todo'))
    const nextOrder = laneTasks.length > 0 ? Math.max(...laneTasks.map((t) => t.order || 0)) + 1 : 0

    const newTask: TaskItem = {
      id: `task-${now}-${crypto.randomBytes(4).toString('hex')}`,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      status: input.status || 'todo',
      priority: input.priority || 'medium',
      workspacePath: input.workspacePath,
      order: input.order !== undefined ? input.order : nextOrder,
      sessionId: input.sessionId,
      steps: input.steps || [],
      createdAt: now,
      updatedAt: now
    }

    this.tasks.push(newTask)
    this.save()
    return newTask
  }

  public update(id: string, updates: UpdateTaskInput): TaskItem | null {
    const index = this.tasks.findIndex((t) => t.id === id)
    if (index === -1) return null

    const existing = this.tasks[index]
    const updated: TaskItem = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      updatedAt: Date.now()
    }

    this.tasks[index] = updated
    this.save()
    return updated
  }

  public delete(id: string): boolean {
    const initialLen = this.tasks.length
    this.tasks = this.tasks.filter((t) => t.id !== id)
    if (this.tasks.length !== initialLen) {
      this.save()
      return true
    }
    return false
  }

  public move(id: string, newStatus: TaskStatus, newIndex?: number): TaskItem | null {
    const task = this.getById(id)
    if (!task) return null

    task.status = newStatus
    task.updatedAt = Date.now()

    const laneTasks = this.tasks
      .filter((t) => t.status === newStatus && t.id !== id)
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    if (newIndex !== undefined && newIndex >= 0 && newIndex <= laneTasks.length) {
      laneTasks.splice(newIndex, 0, task)
    } else {
      laneTasks.push(task)
    }

    // Re-assign lane order
    laneTasks.forEach((t, idx) => {
      t.order = idx
    })

    this.save()
    return task
  }
}
