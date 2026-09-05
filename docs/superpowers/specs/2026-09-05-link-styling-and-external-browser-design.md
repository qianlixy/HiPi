# AI 回答中超链接的视觉样式与打开行为优化设计规范

- **关联 Issue**：#11 (优化 AI 回答中超链接的视觉样式与打开行为，使用系统默认浏览器打开)
- **状态**：已批准 (Approved)
- **日期**：2026-09-05

## 1. 背景与目标

在当前的聊天交互中，Markdown 渲染出的超链接存在以下体验与安全问题：
1. **视觉辨识度不足**：缺少符合现代开发工具设计语言的链接视觉样式与悬停效果，用户难以辨别可点击文本。
2. **跳转行为存在风险**：在 Electron 环境中，若未严格拦截窗口内直接跳转或未通过系统浏览器打开，点击链接可能破坏客户端主窗口内的聊天视图与流式状态。
3. **安全隐患**：缺少对外部 URL 协议的严格白名单校验（如拦截 `javascript:` 或 `file:` 协议）。

**核心目标**：
1. **系统默认浏览器打开**：所有外部超链接统一调用 Electron `shell.openExternal` 唤起操作系统默认浏览器。
2. **多层级防跳保护**：渲染层事件拦截 + 主进程 WebContents `will-navigate` 与 `setWindowOpenHandler` 双重保险，严禁客户端内跳转。
3. **现代极简视觉规范（选项 A）**：科技蓝高对比度强调色 + 悬停下划线渐变 + 光标手型与链接 URL 浮动提示（原生 title 属性），兼顾浅色/深色主题的可读性。
4. **高质量单测保障**：主进程协议白名单拦截单测 + 渲染层链接组件渲染与点击交互单测 100% 覆盖。

---

## 2. 总体架构与数据流

```
[ 用户点击 AI 回答中的链接 ]
            │
            ▼
[ MessageItem <a> 组件 onClick 事件 ]
    ├── e.preventDefault() 阻止默认窗口跳转
    └── window.hipiApi.system.openExternal(url)
            │ (IPC 调用 'system:open-external')
            ▼
[ 主进程 registerIpcHandlers: 'system:open-external' ]
    ├── URL 协议安全性检查 (严格白名单: http:, https:, mailto:)
    │       ├── 包含在白名单 -> shell.openExternal(url) -> 唤起系统浏览器
    │       └── 包含在高危黑名单 -> 拒绝执行并记录警告
    ▼
[ 兜底防线: mainWindow.webContents.on('will-navigate') ]
    └── 若发生意外跳转，强制 event.preventDefault() 并转交给 shell.openExternal
```

---

## 3. 详细设计规范

### 3.1 主进程层 (Main Process)

#### 3.1.1 IPC 处理器：`system:open-external`
- **文件路径**：`src/main/ipc/register-handlers.ts`
- **处理逻辑**：
  ```ts
  const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

  ipcMain.handle('system:open-external', async (_, rawUrl: string): Promise<boolean> => {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return false
    }
    try {
      const parsed = new URL(rawUrl)
      if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
        console.warn(`[Security] Blocked opening external URL with disallowed protocol: ${rawUrl}`)
        return false
      }
      await shell.openExternal(rawUrl)
      return true
    } catch (err) {
      console.error(`[Security] Invalid URL passed to open-external: ${rawUrl}`, err)
      return false
    }
  })
  ```

#### 3.1.2 窗口导航硬兜底：`mainWindow.webContents` 防御
- **文件路径**：`src/main/index.ts`
- **处理逻辑**：
  - 维持现有 `mainWindow.webContents.setWindowOpenHandler` 逻辑：阻止新窗口创建并在外部打开。
  - 增加 `mainWindow.webContents.on('will-navigate', (event, url) => ...)`：
    ```ts
    mainWindow.webContents.on('will-navigate', (event, url) => {
      const currentUrl = mainWindow?.webContents.getURL()
      // 如果跳转目标非当前本地加载页面，拦截并交给外部系统浏览器
      if (url !== currentUrl) {
        event.preventDefault()
        try {
          const parsed = new URL(url)
          if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
            shell.openExternal(url)
          }
        } catch {
          // ignore invalid urls
        }
      }
    })
    ```

---

### 3.2 Preload 桥接与类型定义

#### 3.2.1 Preload 接口定义
- **文件路径**：`src/preload/index.ts`
- **扩展内容**：
  ```ts
  system: {
    openExternal: (url: string): Promise<boolean> =>
      ipcRenderer.invoke('system:open-external', url)
  }
  ```

#### 3.2.2 TypeScript 声明
- **文件路径**：`src/preload/index.d.ts` 与 `src/renderer/src/env.d.ts`
- **类型补充**：
  ```ts
  interface SystemApi {
    openExternal: (url: string) => Promise<boolean>
  }
  ```

---

### 3.3 渲染层 (Renderer Process)

#### 3.3.1 `MessageItem.tsx` 定制 `a` 组件
- **文件路径**：`src/renderer/src/components/chat/MessageItem.tsx`
- **样式规范（极简 GitHub/VSCode 风格）**：
  - 类名：`text-[#58a6ff] hover:text-[#79c0ff] hover:underline underline-offset-2 decoration-[#58a6ff]/60 cursor-pointer font-medium transition-colors duration-150 break-all`
  - 包含原生属性：`target="_blank"`、`rel="noopener noreferrer"`、`title={href}`
- **点击交互实现**：
  ```tsx
  a({ href, children, ...props }) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      if (href) {
        if (window.hipiApi?.system?.openExternal) {
          window.hipiApi.system.openExternal(href)
        } else {
          window.open(href, '_blank', 'noopener,noreferrer')
        }
      }
    }

    return (
      <a
        href={href}
        onClick={handleClick}
        target="_blank"
        rel="noopener noreferrer"
        title={href}
        className="text-[#58a6ff] hover:text-[#79c0ff] hover:underline underline-offset-2 decoration-[#58a6ff]/60 cursor-pointer font-medium transition-colors duration-150 break-all"
        {...props}
      >
        {children}
      </a>
    )
  }
  ```

#### 3.3.2 CSS 全局兜底
- **文件路径**：`src/renderer/src/index.css`
- **增加样式**：
  ```css
  .prose a {
    color: #58a6ff;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s ease-in-out;
  }
  .prose a:hover {
    color: #79c0ff;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  ```

---

## 4. 单元测试与质量指标

### 4.1 主进程协议白名单单测 (`src/main/ipc/__tests__/open-external.test.ts`)
- 验证合法协议（`http://`, `https://`, `mailto:`）正常调用 `shell.openExternal` 且返回 `true`。
- 验证非法/恶意协议（`javascript:`, `file:`, `data:` 等）被阻断，不调用 `shell.openExternal` 且返回 `false`。
- 验证非法 URL 字符串、空字符串、非字符串入参的异常容错。

### 4.2 渲染层组件单测 (`src/renderer/src/components/chat/__tests__/MessageItem.test.tsx`)
- 验证 Markdown 文本中 `[链接文本](https://example.com)` 正常渲染为 `<a>` 标签。
- 验证 `<a>` 标签具有正确的 class 样式、`href`、`title`、`target="_blank"` 与 `rel="noopener noreferrer"`。
- 模拟用户点击链接，断言 `e.preventDefault()` 生效，并且 `window.hipiApi.system.openExternal` 接收到目标链接入参。
- 验证无 `window.hipiApi` 时降级到 `window.open`。
