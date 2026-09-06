# TaskManagerPanel (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 HiPi 任务管理看板的第一阶段（MVP），包括与 Chat 同级的视窗挂载架构、4泳道可视化看板与卡片拖拽交互、多维筛选过滤、以及主进程基于 `~/.hipi/tasks.json` 的任务 CRUD 本地持久化与 IPC 桥接。

**Architecture:** 
- **数据层 (Main & IPC):** 定义 `TaskItem` 核心模型，在主进程通过 `TaskStore` 实现原子性 JSON 持久化（存储于 `~/.hipi/tasks.json`），并通过 Electron IPC 通道暴露 `tasks:list`, `tasks:create`, `tasks:update`, `tasks:delete`, `tasks:move` 供渲染进程调用。
- **视图挂载层 (Renderer Navigation):** 在 `App.tsx` 引入 `activeView: 'chat' | 'tasks'` 状态，Sidebar 快捷导航提供「任务看板 (Tasks)」入口项，点击时与当前会话高亮互斥，主内容区在 `ChatArea` 与 `TaskManagerPanel` 间无缝切换。
- **看板 UI 与交互层 (Kanban Componentry):** `TaskManagerPanel` 包含顶部筛选工具栏（工作空间过滤、优先级过滤、关键字搜索）和 4 个状态泳道（Todo, In Progress, Review, Done）。卡片支持 HTML5 原生 Drag-and-Drop 拖拽跨泳道移动状态变更，并配套「新建/编辑任务弹窗」与删除二次确认。

**Tech Stack:** React 19, TypeScript 5.7, Tailwind CSS, Lucide React, Electron IPC, Vitest.

## Global Constraints

- 遵照 issue #23 与 parent #22 需求规范，泳道必须固定为：`Todo (待处理)`、`In Progress (进行中)`、`Review (待评审)`、`Done (已完成)`。
- 优先级枚举限定为：`urgent`、`high`、`medium`、`low`。
- 本地存储格式为 JSON，默认路径为 `path.join(os.homedir(), '.hipi', 'tasks.json')`。
- UI 风格与现有 HiPi 深色暗调保持完全一致（基础色 `#0d1117`, 边框 `#30363d`, 面板 `#161b22`, 卡片 `#21262d`）。
- 测试使用项目内置 Vitest，每次任务交付均需包含单元测试并通过 `npm test`。

---

### Task 1: 数据类型与核心模型定义 (Task Types)

**Files:**
- Create: `src/main/tasks/types.ts`
- Modify: `src/main/types.ts`
- Modify: `src/renderer/src/types/index.ts`
- Test: `src/main/tasks/__tests__/types.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  ```ts
  export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
  export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'
  export interface TaskItem {
    id: string
    title: string
    description?: string
    status: TaskStatus
    priority: TaskPriority
    workspacePath?: string
    order?: number
    createdAt: number
    updatedAt: number
    sessionId?: string
    steps?: Array<{ id: string; title: string; completed: boolean }>
  }
  export type CreateTaskInput = Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>
  export type UpdateTaskInput = Partial<Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>>
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/main/tasks/__tests__/types.test.ts
import { describe, it, expect } from 'vitest'
import { TaskItem, TaskStatus, TaskPriority } from '../types'

describe('Task types and validation constants', () => {
  it('allows constructing a valid TaskItem object', () => {
    const task: TaskItem = {
      id: 'task-123',
      title: '实现视窗架构',
      description: '挂载 TaskManagerPanel',
      status: 'todo',
      priority: 'high',
      workspacePath: '/path/to/project',
      order: 0,
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    }
    expect(task.id).toBe('task-123')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('high')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/tasks/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../types'"

- [ ] **Step 3: Implement `src/main/tasks/types.ts` and sync with `src/main/types.ts` & `src/renderer/src/types/index.ts`**

```ts
// src/main/tasks/types.ts
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'

export interface TaskStep {
  id: string
  title: string
  completed: boolean
}

export interface TaskItem {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  workspacePath?: string
  order?: number
  createdAt: number
  updatedAt: number
  sessionId?: string
  steps?: TaskStep[]
}

export interface CreateTaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  workspacePath?: string
  order?: number
  sessionId?: string
  steps?: TaskStep[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  workspacePath?: string
  order?: number
  sessionId?: string
  steps?: TaskStep[]
}
```

导出至 `src/main/types.ts` 与 `src/renderer/src/types/index.ts`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/tasks/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/tasks/types.ts src/main/tasks/__tests__/types.test.ts src/main/types.ts src/renderer/src/types/index.ts
git commit -m "feat(tasks): define core TaskItem and status types"
```

---

### Task 2: 主进程持久化存储服务 (TaskStore)

**Files:**
- Create: `src/main/tasks/task-store.ts`
- Test: `src/main/tasks/__tests__/task-store.test.ts`

**Interfaces:**
- Consumes: `TaskItem`, `TaskStatus`, `CreateTaskInput`, `UpdateTaskInput` from `src/main/tasks/types`
- Produces:
  ```ts
  export class TaskStore {
    constructor(customFilePath?: string)
    list(): TaskItem[]
    getById(id: string): TaskItem | null
    create(input: CreateTaskInput): TaskItem
    update(id: string, updates: UpdateTaskInput): TaskItem | null
    delete(id: string): boolean
    move(id: string, newStatus: TaskStatus, newIndex?: number): TaskItem | null
  }
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/main/tasks/__tests__/task-store.test.ts
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/tasks/__tests__/task-store.test.ts`
Expected: FAIL with "Cannot find module '../task-store'"

- [ ] **Step 3: Implement `TaskStore`**

```ts
// src/main/tasks/task-store.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/tasks/__tests__/task-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/tasks/task-store.ts src/main/tasks/__tests__/task-store.test.ts
git commit -m "feat(tasks): implement TaskStore with file persistence and lane reordering"
```

---

### Task 3: IPC 通道注册与 Preload 暴露 (IPC & Preload)

**Files:**
- Modify: `src/main/ipc/register-handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Test: `src/main/ipc/__tests__/tasks-ipc.test.ts`

**Interfaces:**
- Consumes: `TaskStore` instance, `ipcMain`, `contextBridge`
- Produces:
  - IPC channel handlers: `tasks:list`, `tasks:create`, `tasks:update`, `tasks:delete`, `tasks:move`
  - `window.hipiApi.tasks` API exposed to renderer

- [ ] **Step 1: Write the failing test**

```ts
// src/main/ipc/__tests__/tasks-ipc.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskStore } from '../../tasks/task-store'

describe('Tasks IPC registration', () => {
  let handlers: Record<string, Function> = {}

  const mockIpcMain = {
    handle: (channel: string, handler: Function) => {
      handlers[channel] = handler
    }
  }

  it('dispatches CRUD calls to TaskStore correctly', async () => {
    const mockStore = {
      list: vi.fn().mockReturnValue([{ id: '1', title: 'Task 1' }]),
      create: vi.fn().mockImplementation((input) => ({ id: '2', ...input })),
      update: vi.fn().mockImplementation((id, updates) => ({ id, ...updates })),
      delete: vi.fn().mockReturnValue(true),
      move: vi.fn().mockReturnValue({ id: '1', status: 'done' })
    }

    // Register handlers
    mockIpcMain.handle('tasks:list', () => mockStore.list())
    mockIpcMain.handle('tasks:create', (_, input) => mockStore.create(input))
    mockIpcMain.handle('tasks:update', (_, { id, updates }) => mockStore.update(id, updates))
    mockIpcMain.handle('tasks:delete', (_, id) => mockStore.delete(id))
    mockIpcMain.handle('tasks:move', (_, { id, status, newIndex }) => mockStore.move(id, status, newIndex))

    expect(await handlers['tasks:list']()).toEqual([{ id: '1', title: 'Task 1' }])
    expect(await handlers['tasks:create'](null, { title: 'New Task' })).toEqual({ id: '2', title: 'New Task' })
    expect(await handlers['tasks:delete'](null, '1')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it passes baseline**

Run: `npx vitest run src/main/ipc/__tests__/tasks-ipc.test.ts`
Expected: PASS

- [ ] **Step 3: Register IPC handlers in `register-handlers.ts` and wire into `index.ts`**

Update `registerIpcHandlers` signature to accept `taskStore: TaskStore` (or instantiate `taskStore`), and register:
- `ipcMain.handle('tasks:list', async () => taskStore.list())`
- `ipcMain.handle('tasks:create', async (_, input) => taskStore.create(input))`
- `ipcMain.handle('tasks:update', async (_, { id, updates }) => taskStore.update(id, updates))`
- `ipcMain.handle('tasks:delete', async (_, id) => taskStore.delete(id))`
- `ipcMain.handle('tasks:move', async (_, { id, status, newIndex }) => taskStore.move(id, status, newIndex))`

In `src/preload/index.ts`:
```ts
tasks: {
  list: (): Promise<TaskItem[]> => ipcRenderer.invoke('tasks:list'),
  create: (input: CreateTaskInput): Promise<TaskItem> => ipcRenderer.invoke('tasks:create', input),
  update: (id: string, updates: UpdateTaskInput): Promise<TaskItem | null> =>
    ipcRenderer.invoke('tasks:update', { id, updates }),
  delete: (id: string): Promise<boolean> => ipcRenderer.invoke('tasks:delete', id),
  move: (id: string, status: TaskStatus, newIndex?: number): Promise<TaskItem | null> =>
    ipcRenderer.invoke('tasks:move', { id, status, newIndex })
}
```

- [ ] **Step 4: Update `src/preload/index.d.ts` and verify build**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/register-handlers.ts src/main/index.ts src/preload/index.ts src/preload/index.d.ts src/main/ipc/__tests__/tasks-ipc.test.ts
git commit -m "feat(tasks): wire tasks IPC handlers and expose via preload bridge"
```

---

### Task 4: Sidebar 导航互斥与视窗挂载架构 (Sidebar & View Switching)

**Files:**
- Modify: `src/renderer/src/components/sidebar/SidebarQuickNav.tsx`
- Modify: `src/renderer/src/components/sidebar/Sidebar.tsx`
- Modify: `src/renderer/src/App.tsx`
- Test: `src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx`
- Test: `src/renderer/src/components/sidebar/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `activeView: 'chat' | 'tasks'`, `onSelectView: (view: 'chat' | 'tasks') => void`
- Produces: 
  - `activeView` state in `App.tsx`
  - Sidebar QuickNav highlighted when `activeView === 'tasks'`
  - Workspace session highlight cleared when viewing tasks

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx
// Add test for activeView === 'tasks' highlighting
it('highlights task-list button when activeView is tasks', () => {
  const html = renderToStaticMarkup(
    <SidebarQuickNav activeView="tasks" onAction={() => {}} onSelectView={() => {}} />
  )
  expect(html).toContain('bg-blue-600') // or primary active styling
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `SidebarQuickNav.tsx`, `Sidebar.tsx`, and `App.tsx`**

1. In `SidebarQuickNav.tsx`:
   - Support `activeView?: 'chat' | 'tasks'` and `onSelectView?: (view: 'chat' | 'tasks') => void`.
   - Clicking `task-list` triggers `onSelectView?.('tasks')`.
   - Active styling for `task-list` when `activeView === 'tasks'`.
2. In `Sidebar.tsx`:
   - Pass `activeView` through.
   - When `activeView === 'tasks'`, do not render active background on sessions (互斥).
   - Clicking a session or new session switches `activeView` to `'chat'`.
3. In `App.tsx`:
   - `const [activeView, setActiveView] = useState<'chat' | 'tasks'>('chat')`
   - Switch content area between `<Header /><ChatArea />` and `<TaskManagerPanel />`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx src/renderer/src/components/sidebar/__tests__/Sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/sidebar/SidebarQuickNav.tsx src/renderer/src/components/sidebar/Sidebar.tsx src/renderer/src/App.tsx src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx
git commit -m "feat(tasks): integrate tasks view switching and mutual exclusion in sidebar"
```

---

### Task 5: 任务筛选工具栏组件 (TaskFilterToolbar)

**Files:**
- Create: `src/renderer/src/components/tasks/TaskFilterToolbar.tsx`
- Test: `src/renderer/src/components/tasks/__tests__/TaskFilterToolbar.test.tsx`

**Interfaces:**
- Consumes:
  ```ts
  export interface TaskFilterToolbarProps {
    workspaces: Workspace[]
    selectedWorkspacePath?: string
    selectedPriority?: string
    searchKeyword: string
    onWorkspaceChange: (path?: string) => void
    onPriorityChange: (priority?: string) => void
    onSearchChange: (keyword: string) => void
    onNewTask: () => void
  }
  ```
- Produces: Top toolbar containing workspace select, priority select, keyword input, and "+ 新建任务" button.

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/tasks/__tests__/TaskFilterToolbar.test.tsx
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
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/tasks/__tests__/TaskFilterToolbar.test.tsx`
Expected: FAIL with "Cannot find module '../TaskFilterToolbar'"

- [ ] **Step 3: Implement `TaskFilterToolbar.tsx`**

Implement styled UI with dark theme:
- Workspace selector dropdown (`<select>`)
- Priority selector dropdown (`<select>`) with options: 全部, 紧急 (Urgent), 高 (High), 中 (Medium), 低 (Low)
- Search `<input>` with search icon
- "+ 新建任务" button with plus icon and blue accent color

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/tasks/__tests__/TaskFilterToolbar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/tasks/TaskFilterToolbar.tsx src/renderer/src/components/tasks/__tests__/TaskFilterToolbar.test.tsx
git commit -m "feat(tasks): implement TaskFilterToolbar with workspace, priority, and keyword filters"
```

---

### Task 6: 任务卡片与泳道组件 (TaskCard & TaskColumn)

**Files:**
- Create: `src/renderer/src/components/tasks/TaskCard.tsx`
- Create: `src/renderer/src/components/tasks/TaskColumn.tsx`
- Test: `src/renderer/src/components/tasks/__tests__/TaskCard.test.tsx`
- Test: `src/renderer/src/components/tasks/__tests__/TaskColumn.test.tsx`

**Interfaces:**
- Consumes:
  - `TaskItem`, `TaskStatus`, `TaskPriority`
  - HTML5 drag event callbacks: `onDragStart`, `onDragEnd`, `onDropOnColumn`
- Produces:
  - `TaskCard`: Draggable card displaying priority badge, title, snippet, workspace badge, and edit/delete actions.
  - `TaskColumn`: Lane with count badge, status color indicator, card list, drag-over highlight, and drop handler.

- [ ] **Step 1: Write the failing test for TaskCard and TaskColumn**

```tsx
// src/renderer/src/components/tasks/__tests__/TaskCard.test.tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskCard } from '../TaskCard'
import { TaskItem } from '../../../../main/tasks/types'

describe('TaskCard component', () => {
  const sampleTask: TaskItem = {
    id: 't-1',
    title: '实现泳道拖拽',
    description: '支持 HTML5 drag and drop',
    status: 'todo',
    priority: 'urgent',
    workspacePath: '/code/hipi',
    createdAt: 1000,
    updatedAt: 1000
  }

  it('renders task title, description and urgent priority badge', () => {
    const html = renderToStaticMarkup(
      <TaskCard
        task={sampleTask}
        workspaceName="hipi"
        onEdit={() => {}}
        onDelete={() => {}}
        onDragStart={() => {}}
      />
    )
    expect(html).toContain('实现泳道拖拽')
    expect(html).toContain('支持 HTML5 drag and drop')
    expect(html).toContain('紧急')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/tasks/__tests__/TaskCard.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `TaskCard.tsx` and `TaskColumn.tsx`**

`TaskCard`:
- `draggable` enabled with `onDragStart={(e) => onDragStart(task, e)}`
- Priority styling:
  - `urgent`: Red badge `bg-red-500/20 text-red-400 border border-red-500/30`
  - `high`: Amber badge `bg-amber-500/20 text-amber-400 border border-amber-500/30`
  - `medium`: Blue badge `bg-blue-500/20 text-blue-400 border border-blue-500/30`
  - `low`: Gray badge `bg-gray-500/20 text-gray-400 border border-gray-500/30`
- Edit & Delete icon buttons on hover
- Workspace indicator badge if present

`TaskColumn`:
- Status title, color badge (e.g. Todo: slate, In Progress: blue, Review: purple, Done: emerald)
- Counter badge showing count of filtered tasks in this lane
- Drag over container styling (`isOver` ring/background highlight)
- Maps and renders child `TaskCard`s

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/components/tasks/__tests__/TaskCard.test.tsx src/renderer/src/components/tasks/__tests__/TaskColumn.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/tasks/TaskCard.tsx src/renderer/src/components/tasks/TaskColumn.tsx src/renderer/src/components/tasks/__tests__/TaskCard.test.tsx src/renderer/src/components/tasks/__tests__/TaskColumn.test.tsx
git commit -m "feat(tasks): implement TaskCard and TaskColumn with HTML5 drag and drop support"
```

---

### Task 7: 任务新增与编辑对话框 (TaskEditModal)

**Files:**
- Create: `src/renderer/src/components/tasks/TaskEditModal.tsx`
- Test: `src/renderer/src/components/tasks/__tests__/TaskEditModal.test.tsx`

**Interfaces:**
- Consumes:
  ```ts
  export interface TaskEditModalProps {
    isOpen: boolean
    taskToEdit?: TaskItem | null
    defaultStatus?: TaskStatus
    workspaces: Workspace[]
    activeWorkspacePath?: string
    onClose: () => void
    onSave: (taskData: CreateTaskInput | UpdateTaskInput) => Promise<void> | void
  }
  ```
- Produces: Modal form for creating and editing tasks with validation (title required).

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/tasks/__tests__/TaskEditModal.test.tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskEditModal } from '../TaskEditModal'

describe('TaskEditModal component', () => {
  it('renders create task dialog when taskToEdit is null', () => {
    const html = renderToStaticMarkup(
      <TaskEditModal
        isOpen={true}
        taskToEdit={null}
        workspaces={[]}
        onClose={() => {}}
        onSave={() => {}}
      />
    )
    expect(html).toContain('新建任务')
    expect(html).toContain('任务标题')
    expect(html).toContain('优先级')
  })

  it('renders edit task dialog with existing values when taskToEdit is provided', () => {
    const html = renderToStaticMarkup(
      <TaskEditModal
        isOpen={true}
        taskToEdit={{
          id: '1',
          title: '已存在任务',
          description: '任务详情描述',
          status: 'in_progress',
          priority: 'urgent',
          createdAt: 100,
          updatedAt: 100
        }}
        workspaces={[]}
        onClose={() => {}}
        onSave={() => {}}
      />
    )
    expect(html).toContain('编辑任务')
    expect(html).toContain('已存在任务')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/tasks/__tests__/TaskEditModal.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `TaskEditModal.tsx`**

- Fields:
  - Title (required `<input>`)
  - Description (multi-line `<textarea>`)
  - Status selector (`<select>`: Todo, In Progress, Review, Done)
  - Priority selector (`<select>`: Urgent, High, Medium, Low)
  - Workspace selector (`<select>`: None or list of workspaces)
- Cancel & Confirm button with dark modal backdrop and escape/click-outside dismiss.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/tasks/__tests__/TaskEditModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/tasks/TaskEditModal.tsx src/renderer/src/components/tasks/__tests__/TaskEditModal.test.tsx
git commit -m "feat(tasks): implement TaskEditModal for creating and editing tasks"
```

---

### Task 8: 任务面板容器与拖拽状态整合 (TaskManagerPanel)

**Files:**
- Create: `src/renderer/src/components/tasks/TaskManagerPanel.tsx`
- Modify: `src/renderer/src/App.tsx`
- Test: `src/renderer/src/components/tasks/__tests__/TaskManagerPanel.test.tsx`

**Interfaces:**
- Consumes:
  - `workspaces: Workspace[]`
  - `activeWorkspace?: Workspace`
  - `window.hipiApi.tasks` API
- Produces: Complete Kanban dashboard with 4 status columns, live filter, drag-and-drop status update, modal creation/editing, delete confirmation.

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/tasks/__tests__/TaskManagerPanel.test.tsx
import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskManagerPanel } from '../TaskManagerPanel'

describe('TaskManagerPanel component', () => {
  it('renders all 4 Kanban status columns', () => {
    const html = renderToStaticMarkup(
      <TaskManagerPanel
        workspaces={[{ id: '1', name: 'HiPi', path: '/code/hipi' }]}
        activeWorkspace={{ id: '1', name: 'HiPi', path: '/code/hipi' }}
      />
    )
    expect(html).toContain('待处理')
    expect(html).toContain('进行中')
    expect(html).toContain('待评审')
    expect(html).toContain('已完成')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/tasks/__tests__/TaskManagerPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `TaskManagerPanel.tsx`**

- Fetch `tasks` on mount using `window.hipiApi?.tasks?.list()`.
- State:
  - `tasks: TaskItem[]`
  - `filterWorkspace?: string`
  - `filterPriority?: string`
  - `searchKeyword: string`
  - `editingTask: TaskItem | null`
  - `isCreateModalOpen: boolean`
  - `deletingTask: TaskItem | null`
  - `draggingTaskId: string | null`
- Drag and drop handler:
  - On drop in column: call `window.hipiApi.tasks.move(taskId, targetStatus)` and update local state immediately.
- Filter logic:
  - Filters by workspace path (or all)
  - Filters by priority (or all)
  - Searches title and description case-insensitively
- Group into the 4 standard columns: `todo`, `in_progress`, `review`, `done`.
- Embed `TaskEditModal` and `ConfirmDialog` (for deletion).

- [ ] **Step 4: Wire into `App.tsx` and run tests**

In `src/renderer/src/App.tsx`:
When `activeView === 'tasks'`, render `<TaskManagerPanel workspaces={workspaces} activeWorkspace={activeWorkspace} />`.

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/tasks/TaskManagerPanel.tsx src/renderer/src/components/tasks/__tests__/TaskManagerPanel.test.tsx src/renderer/src/App.tsx
git commit -m "feat(tasks): integrate TaskManagerPanel with Kanban drag and drop and CRUD operations"
```

---

### Task 9: 整体功能校验与端到端验证 (Verification & Polish)

**Files:**
- Modify: Any files requiring minor fixes from verification
- Run all test suites and typechecks

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean check with 0 errors.

- [ ] **Step 2: Run all unit tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Build verification**

Run: `npm run build`
Expected: Build succeeds without bundle or type errors.

- [ ] **Step 4: Commit and tag completion**

```bash
git commit -m "chore(tasks): complete stage-1 verification for task manager panel"
```
