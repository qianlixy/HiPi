# Sidebar 快捷导航与功能扩展区实现计划 (Issue #16)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Sidebar Header 下方增加常驻快捷导航区（含「新建会话」与「任务列表」两个快捷入口），点击时弹出轻量 Toast 提示「敬请期待」，并为后续功能迭代打下可扩展的架构基础。

**Architecture:** 
采用配置驱动的独立组件 `SidebarQuickNav` 与通用受控浮层 `Toast` 组件。`Sidebar` 常驻挂载快捷导航区并平滑分隔下方的工作空间列表；`App.tsx` 统筹 Toast 提示状态。

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, React Testing Library.

## Global Constraints
- 入口项为「新建会话」（附快捷键 `⌘N` 标签）与「任务列表」。
- 点击两项后统一提示「敬请期待」。
- 导航区必须固定置顶在 Header 之下、工作区列表之上，不随工作区列表滚动。
- 遵循现有的 ESLint/TypeScript 规范与 Vitest 单测规范，单测覆盖率需完备。

---

### Task 1: 实现通用轻量 Toast 组件及其单测

**Files:**
- Create: `src/renderer/src/components/common/Toast.tsx`
- Test: `src/renderer/src/components/common/__tests__/Toast.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface ToastProps {
    message: string | null
    duration?: number
    onClose: () => void
  }
  export const Toast: React.FC<ToastProps>
  ```

- [ ] **Step 1: 编写 Toast 组件的失败单测**

创建 `src/renderer/src/components/common/__tests__/Toast.test.tsx`：
```tsx
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Toast } from '../Toast'

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when message is null', () => {
    const { container } = render(<Toast message={null} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders message text and alert icon when message is provided', () => {
    render(<Toast message="敬请期待" onClose={vi.fn()} />)
    expect(screen.getByText('敬请期待')).toBeInTheDocument()
  })

  it('calls onClose after default duration (2000ms)', () => {
    const handleClose = vi.fn()
    render(<Toast message="敬请期待" onClose={handleClose} />)

    expect(handleClose).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose after custom duration', () => {
    const handleClose = vi.fn()
    render(<Toast message="自定义提示" duration={1000} onClose={handleClose} />)

    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(handleClose).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行单测验证失败**

运行：`npm test src/renderer/src/components/common/__tests__/Toast.test.tsx`
预期：FAIL，提示找不到 `../Toast` 模块。

- [ ] **Step 3: 实现 `Toast.tsx`**

创建 `src/renderer/src/components/common/Toast.tsx`：
```tsx
import React, { useEffect } from 'react'
import { Sparkles } from 'lucide-react'

export interface ToastProps {
  message: string | null
  duration?: number
  onClose: () => void
}

export const Toast: React.FC<ToastProps> = ({
  message,
  duration = 2000,
  onClose
}) => {
  useEffect(() => {
    if (!message) return

    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [message, duration, onClose])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-[#1c2128] border border-[#30363d] shadow-xl text-gray-200 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none"
    >
      <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}
```

- [ ] **Step 4: 运行单测验证通过**

运行：`npm test src/renderer/src/components/common/__tests__/Toast.test.tsx`
预期：PASS（4 个测试全部通过）。

- [ ] **Step 5: 提交代码**

```bash
git add src/renderer/src/components/common/Toast.tsx src/renderer/src/components/common/__tests__/Toast.test.tsx
git commit -m "feat(ui): add lightweight Toast component with unit tests"
```

---

### Task 2: 实现快捷导航组件 `SidebarQuickNav` 及其单测

**Files:**
- Create: `src/renderer/src/components/sidebar/SidebarQuickNav.tsx`
- Test: `src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface QuickNavItem {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    shortcut?: string
    badge?: string | number
    onClick: () => void
  }

  export interface SidebarQuickNavProps {
    onAction?: (actionId: string, label: string) => void
  }

  export const SidebarQuickNav: React.FC<SidebarQuickNavProps>
  ```

- [ ] **Step 1: 编写 `SidebarQuickNav` 的失败单测**

创建 `src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx`：
```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidebarQuickNav } from '../SidebarQuickNav'

describe('SidebarQuickNav Component', () => {
  it('renders quick action buttons: 新建会话 and 任务列表', () => {
    render(<SidebarQuickNav onAction={vi.fn()} />)
    expect(screen.getByText('新建会话')).toBeInTheDocument()
    expect(screen.getByText('任务列表')).toBeInTheDocument()
  })

  it('renders the shortcut tag ⌘N for new session', () => {
    render(<SidebarQuickNav onAction={vi.fn()} />)
    expect(screen.getByText('⌘N')).toBeInTheDocument()
  })

  it('renders section title 工作空间', () => {
    render(<SidebarQuickNav onAction={vi.fn()} />)
    expect(screen.getByText('工作空间')).toBeInTheDocument()
  })

  it('calls onAction with correct id and label when clicking 新建会话', () => {
    const handleAction = vi.fn()
    render(<SidebarQuickNav onAction={handleAction} />)

    fireEvent.click(screen.getByText('新建会话'))
    expect(handleAction).toHaveBeenCalledWith('new-session', '新建会话')
  })

  it('calls onAction with correct id and label when clicking 任务列表', () => {
    const handleAction = vi.fn()
    render(<SidebarQuickNav onAction={handleAction} />)

    fireEvent.click(screen.getByText('任务列表'))
    expect(handleAction).toHaveBeenCalledWith('task-list', '任务列表')
  })
})
```

- [ ] **Step 2: 运行单测验证失败**

运行：`npm test src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx`
预期：FAIL，提示找不到 `../SidebarQuickNav` 模块。

- [ ] **Step 3: 实现 `SidebarQuickNav.tsx`**

创建 `src/renderer/src/components/sidebar/SidebarQuickNav.tsx`：
```tsx
import React from 'react'
import { MessageSquarePlus, ListTodo } from 'lucide-react'

export interface QuickNavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  badge?: string | number
  onClick: () => void
}

export interface SidebarQuickNavProps {
  onAction?: (actionId: string, label: string) => void
}

export const SidebarQuickNav: React.FC<SidebarQuickNavProps> = ({ onAction }) => {
  const items: QuickNavItem[] = [
    {
      id: 'new-session',
      label: '新建会话',
      icon: MessageSquarePlus,
      shortcut: '⌘N',
      onClick: () => onAction?.('new-session', '新建会话')
    },
    {
      id: 'task-list',
      label: '任务列表',
      icon: ListTodo,
      onClick: () => onAction?.('task-list', '任务列表')
    }
  ]

  return (
    <div className="flex-shrink-0 px-2 pt-2.5 pb-1 select-none">
      {/* Quick Action Entries */}
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const isPrimary = item.id === 'new-session'
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-all group ${
                isPrimary
                  ? 'bg-[#21262d]/60 hover:bg-[#21262d] text-gray-200 border border-[#30363d]/60 hover:border-[#30363d]'
                  : 'hover:bg-[#21262d] text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isPrimary ? 'text-blue-400 group-hover:text-blue-300' : 'text-gray-400 group-hover:text-gray-300'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.shortcut && (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-[#161b22] border border-[#30363d] rounded">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          )
        })}
      </div>

      {/* Section Divider & Label */}
      <div className="pt-3 pb-1 px-1 flex items-center justify-between text-[11px] font-medium text-gray-500">
        <span>工作空间</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行单测验证通过**

运行：`npm test src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx`
预期：PASS（5 个测试全部通过）。

- [ ] **Step 5: 提交代码**

```bash
git add src/renderer/src/components/sidebar/SidebarQuickNav.tsx src/renderer/src/components/sidebar/__tests__/SidebarQuickNav.test.tsx
git commit -m "feat(sidebar): implement SidebarQuickNav component with unit tests"
```

---

### Task 3: 在 `Sidebar.tsx` 中挂载 `SidebarQuickNav` 并编写单元测试

**Files:**
- Modify: `src/renderer/src/components/sidebar/Sidebar.tsx`
- Create: `src/renderer/src/components/sidebar/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `SidebarQuickNav`, `QuickNavItem`
- Modifies `SidebarProps`:
  ```ts
  interface SidebarProps {
    // ...原有属性保持兼容
    onQuickAction?: (actionId: string, label: string) => void
  }
  ```

- [ ] **Step 1: 编写 `Sidebar.test.tsx` 测试快捷导航挂载与回调**

创建 `src/renderer/src/components/sidebar/__tests__/Sidebar.test.tsx`：
```tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    render(<Sidebar {...defaultProps} />)
    expect(screen.getByText('新建会话')).toBeInTheDocument()
    expect(screen.getByText('任务列表')).toBeInTheDocument()
  })

  it('triggers onQuickAction when clicking quick entry', () => {
    const handleQuickAction = vi.fn()
    render(<Sidebar {...defaultProps} onQuickAction={handleQuickAction} />)

    fireEvent.click(screen.getByText('新建会话'))
    expect(handleQuickAction).toHaveBeenCalledWith('new-session', '新建会话')

    fireEvent.click(screen.getByText('任务列表'))
    expect(handleQuickAction).toHaveBeenCalledWith('task-list', '任务列表')
  })
})
```

- [ ] **Step 2: 运行单测验证失败**

运行：`npm test src/renderer/src/components/sidebar/__tests__/Sidebar.test.tsx`
预期：FAIL，因为 `Sidebar.tsx` 尚未集成 `SidebarQuickNav`，未渲染该文本。

- [ ] **Step 3: 修改 `Sidebar.tsx`**

在 `Sidebar.tsx` 中引入 `SidebarQuickNav`，在 Header 之后插入：
```tsx
import { SidebarQuickNav } from './SidebarQuickNav'

// 在 SidebarProps 接口中新增：
onQuickAction?: (actionId: string, label: string) => void

// 在 Header 之后、Workspace 列表之前渲染：
<SidebarQuickNav onAction={onQuickAction} />
```

- [ ] **Step 4: 运行单测验证通过**

运行：`npm test src/renderer/src/components/sidebar/__tests__/Sidebar.test.tsx`
预期：PASS（2 个测试全部通过）。

- [ ] **Step 5: 提交代码**

```bash
git add src/renderer/src/components/sidebar/Sidebar.tsx src/renderer/src/components/sidebar/__tests__/Sidebar.test.tsx
git commit -m "feat(sidebar): integrate SidebarQuickNav into Sidebar"
```

---

### Task 4: 集成到 `App.tsx`，处理「敬请期待」Toast，并运行全量单测

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `Toast` from `./components/common/Toast`
- Passes `onQuickAction` to `<Sidebar />`

- [ ] **Step 1: 在 `App.tsx` 中引入 `Toast` 与状态逻辑**

修改 `src/renderer/src/App.tsx`：
1. 导入 `Toast`：
   ```tsx
   import { Toast } from './components/common/Toast'
   ```
2. 新增 Toast 状态：
   ```tsx
   const [toastMessage, setToastMessage] = useState<string | null>(null)
   ```
3. 新增快速动作响应函数：
   ```tsx
   const handleQuickAction = (_actionId: string, _label: string) => {
     setToastMessage('敬请期待')
   }
   ```
4. 传递给 `Sidebar`：
   ```tsx
   <Sidebar
     ...
     onQuickAction={handleQuickAction}
   />
   ```
5. 在根节点渲染 Toast：
   ```tsx
   <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
   ```

- [ ] **Step 2: 运行全量单测与构建检查**

运行：
```bash
npm test
npm run build
```
预期：
- 所有单元测试（包括新增的 `Toast.test.tsx`, `SidebarQuickNav.test.tsx`, `Sidebar.test.tsx`）全部 PASS。
- `electron-vite build` 编译打包无 TypeScript 或打包报错。

- [ ] **Step 3: 提交代码并推送**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat(app): hook up quick actions with coming soon toast notification"
```
