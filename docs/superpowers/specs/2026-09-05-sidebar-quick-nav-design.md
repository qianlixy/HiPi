# Sidebar 快捷导航与功能扩展区设计规范 (Issue #16)

## 1. 概述与目标

在 HiPi 桌面端侧边栏（Sidebar）Header 下方新增常驻的快捷导航与能力扩展区（Sidebar Quick Actions & Nav Hub）：
1. 提供两项快捷入口：「新建会话」与「任务列表」。
2. 点击两项快捷入口时，使用轻量浮层 Toast 提示「敬请期待」，为后续功能迭代打下规范接口。
3. 采用数据驱动的扩展项配置，确保后续无感接入技能库（Skills）、MCP 扩展、定时任务管理等模块。
4. 编写完备的组件与交互单元测试。

---

## 2. 详细设计与组件划分

### 2.1 轻量 Toast 组件 (`src/renderer/src/components/common/Toast.tsx`)
- **定位与层级**：固定在应用窗口顶部居中（`fixed top-6 left-1/2 -translate-x-1/2 z-50`）。
- **视觉风格**：深色磨砂质感半透明背景（`bg-[#161b22]/90 backdrop-blur-md border border-[#30363d]`），带柔和阴影，与客户端整体视觉风格统一。
- **属性（Props）**：
  ```ts
  export interface ToastProps {
    message: string | null
    duration?: number // 默认 2000ms
    onClose: () => void
  }
  ```
- **交互与生命周期**：
  - 当 `message` 存在时渲染展示，并启动 `duration` 毫秒计时器。
  - 倒计时结束后触发 `onClose`。
  - 支持快捷关闭按钮（可选）或随定时器平滑隐藏。

### 2.2 快捷导航组件 (`src/renderer/src/components/sidebar/SidebarQuickNav.tsx`)
- **布局定位**：
  - 位于 `Sidebar` 头部与工作空间列表之间，设置为常驻置顶（`flex-shrink-0`），不随工作区列表滚动。
- **数据结构与配置驱动**：
  ```ts
  export interface QuickNavItem {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    shortcut?: string
    badge?: string | number
    onClick: () => void
  }
  ```
- **视觉呈现与交互细节**：
  - 主入口「新建会话」：采用突出按钮样式（高亮背景或深色强调框），右侧展示快捷键提示标签（如 `⌘N`）。
  - 扩展入口「任务列表」：采用菜单项列表样式，左侧图标、中间文案、右侧支持角标（Badge）。
  - 悬停与点击反馈：`hover:bg-[#21262d] active:scale-[0.99] transition-all`。
  - 底部区段分割线：以柔和细边框和微标签（`工作空间` / `WORKSPACES`）与下方列表平滑过渡。

### 2.3 集成逻辑 (`Sidebar.tsx` & `App.tsx`)
- **`Sidebar.tsx`**：
  - 引入 `SidebarQuickNav`，在 Header 下方直接渲染。
  - 接收回调 `onQuickAction?: (actionId: string, label: string) => void`，或直接处理默认的「敬请期待」通知。
- **`App.tsx`**：
  - 维护轻量 Toast 状态：
    ```ts
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const showToast = (msg: string) => setToastMessage(msg)
    ```
  - 将回调传给 `Sidebar`，并在根部渲染 `<Toast message={toastMessage} onClose={() => setToastMessage(null)} />`。

---

## 3. 单测计划 (Unit Testing Plan)

使用项目既有的 Vitest + React Testing Library 环境（与现存 `ConfirmDialog.test.tsx`, `SessionItem.test.tsx` 保持一致）：

1. **`Toast.test.tsx`**：
   - 消息为空时不渲染任何 DOM。
   - 消息存在时正确渲染文本内容与图标。
   - 倒计时到达 `duration` 后正确触发 `onClose` 回调（使用 `vi.useFakeTimers()`）。
   - 多次切换 message 能够正确重置定时器。

2. **`SidebarQuickNav.test.tsx`**：
   - 正确渲染「新建会话」与「任务列表」入口项。
   - 快捷键标签（如 `⌘N`）正确渲染。
   - 点击各个入口项能够触发对应 `onClick` 回调。

3. **`Sidebar.test.tsx`**：
   - 验证 `SidebarQuickNav` 成功嵌入 Sidebar Header 下方。
   - 点击新建会话与任务列表时能够触发向上传递的回调或 Toast 提示。
