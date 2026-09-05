# AI 回答中超链接视觉样式与系统浏览器打开行为实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化 AI 回答中 Markdown 超链接的视觉样式（科技蓝高对比度、悬停高亮与下划线渐变）并通过 Electron `shell.openExternal` 唤起操作系统默认浏览器打开，多层级阻断客户端内任何意外页面跳转。

**Architecture:** 主进程提供 `system:open-external` IPC 接口与协议白名单过滤（`http:`, `https:`, `mailto:`），并在 `webContents` 上拦截 `will-navigate` 事件兜底；Preload 暴露 `window.hipiApi.system.openExternal`；渲染层在 `MessageItem.tsx` 中定制 ReactMarkdown 的 `a` 标签组件与 CSS 样式兜底，确保点击阻止默认跳转并调用 IPC。

**Tech Stack:** React 19, TypeScript, Electron 35, Tailwind CSS, ReactMarkdown, Vitest 3.2.

## Global Constraints

- 协议安全白名单严格限定为 `http:`, `https:`, `mailto:`，阻断并忽略其他协议。
- 绝不允许在 Electron 主渲染窗口内直接重定向导航，保持聊天流与界面上下文完好。
- 遵循选项 A 的极简设计：文字高亮科技蓝 `#58a6ff`，悬停 `#79c0ff` 伴随平滑下划线，不增加外部图标，设置原生 `title={href}`。
- 测试必须全部在 Vitest 下通过，且保持全项目既有 53 个单测无回归。

---

### Task 1: 主进程安全打开外部链接逻辑与协议白名单 (Main IPC)

**Files:**
- Modify: `src/main/ipc/register-handlers.ts`
- Test: `src/main/ipc/__tests__/open-external.test.ts`

**Interfaces:**
- Consumes: `shell.openExternal(url: string)` from `electron`
- Produces: `safeOpenExternal(rawUrl: string): Promise<boolean>` and IPC channel `'system:open-external'`

- [ ] **Step 1: Write the failing test for `safeOpenExternal`**

创建 `src/main/ipc/__tests__/open-external.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron shell
vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined)
  },
  ipcMain: {
    handle: vi.fn()
  },
  dialog: {
    showOpenDialog: vi.fn()
  }
}))

import { shell } from 'electron'
import { safeOpenExternal, SAFE_PROTOCOLS } from '../register-handlers'

describe('safeOpenExternal protocol whitelist and behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow http and https protocols and call shell.openExternal', async () => {
    const httpResult = await safeOpenExternal('http://example.com/test')
    expect(httpResult).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith('http://example.com/test')

    const httpsResult = await safeOpenExternal('https://github.com/qianlixy/hipi')
    expect(httpsResult).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith('https://github.com/qianlixy/hipi')
  })

  it('should allow mailto protocol and call shell.openExternal', async () => {
    const mailtoResult = await safeOpenExternal('mailto:developer@example.com')
    expect(mailtoResult).toBe(true)
    expect(shell.openExternal).toHaveBeenCalledWith('mailto:developer@example.com')
  })

  it('should block disallowed protocols like javascript: and file:', async () => {
    const jsResult = await safeOpenExternal('javascript:alert(1)')
    expect(jsResult).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()

    const fileResult = await safeOpenExternal('file:///etc/passwd')
    expect(fileResult).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()

    const dataResult = await safeOpenExternal('data:text/html,<script>alert(1)</script>')
    expect(dataResult).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('should safely handle empty, invalid or non-string inputs', async () => {
    expect(await safeOpenExternal('')).toBe(false)
    expect(await safeOpenExternal('not-a-valid-url')).toBe(false)
    expect(await safeOpenExternal(null as any)).toBe(false)
    expect(await safeOpenExternal(undefined as any)).toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/ipc/__tests__/open-external.test.ts`
Expected: FAIL with "safeOpenExternal is not exported from ../register-handlers"

- [ ] **Step 3: Implement `safeOpenExternal` and register `system:open-external` IPC handler**

在 `src/main/ipc/register-handlers.ts` 中引入 `shell`，定义并导出 `SAFE_PROTOCOLS` 与 `safeOpenExternal`，并在 `registerIpcHandlers` 函数中注册 `system:open-external`：

```ts
import { ipcMain, dialog, BrowserWindow, shell } from 'electron'

export const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export async function safeOpenExternal(rawUrl: string): Promise<boolean> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return false
  }
  try {
    const parsed = new URL(rawUrl)
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
      console.warn(`[Security] Blocked disallowed protocol: ${rawUrl}`)
      return false
    }
    await shell.openExternal(rawUrl)
    return true
  } catch (err) {
    return false
  }
}
```

并在 `registerIpcHandlers` 函数内部末尾追加：
```ts
  // --- System & Shell Handlers ---
  ipcMain.handle('system:open-external', async (_, url: string) => {
    return safeOpenExternal(url)
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/ipc/__tests__/open-external.test.ts`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit changes**

```bash
git add src/main/ipc/register-handlers.ts src/main/ipc/__tests__/open-external.test.ts
git commit -m "feat(main): 添加外部链接安全校验逻辑与 system:open-external IPC 接口"
```

---

### Task 2: 主进程窗口导航防御（will-navigate 事件拦截）

**Files:**
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: `safeOpenExternal` from `./ipc/register-handlers`
- Produces: WebContents 级防内联跳转拦截

- [ ] **Step 1: Check existing `createWindow` navigation handling**

检查 `src/main/index.ts` 中的 `mainWindow.webContents` 设置。目前已有 `setWindowOpenHandler`，但缺少 `will-navigate`。

- [ ] **Step 2: Add `will-navigate` event listener to `mainWindow.webContents`**

在 `src/main/index.ts` 中：
```ts
import { safeOpenExternal } from './ipc/register-handlers'
```
在 `createWindow()` 函数中，紧跟在 `mainWindow.webContents.setWindowOpenHandler(...)` 之后添加：
```ts
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL()
    if (url !== currentUrl) {
      event.preventDefault()
      safeOpenExternal(url).catch((err) => {
        console.error('Failed to open external link on will-navigate:', err)
      })
    }
  })
```

- [ ] **Step 3: Run existing test suite to ensure no regressions**

Run: `npm test`
Expected: PASS (11 test files passed)

- [ ] **Step 4: Commit changes**

```bash
git add src/main/index.ts
git commit -m "feat(main): 监听 will-navigate 事件彻底阻止窗口内外部重定向"
```

---

### Task 3: Preload 桥接与 TypeScript 类型扩展

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/src/env.d.ts`

**Interfaces:**
- Consumes: IPC channel `'system:open-external'`
- Produces: `window.hipiApi.system.openExternal(url: string): Promise<boolean>`

- [ ] **Step 1: Extend preload with `system.openExternal`**

在 `src/preload/index.ts` 中，在 `hipiApi` 对象中增加 `system` 命名空间：
```ts
  system: {
    openExternal: (url: string): Promise<boolean> =>
      ipcRenderer.invoke('system:open-external', url)
  },
```

- [ ] **Step 2: Update TypeScript type definitions**

在 `src/preload/index.d.ts` 中定义 `SystemApi` 并挂入 `HipiApi`：
```ts
export interface SystemApi {
  openExternal: (url: string) => Promise<boolean>
}

// 在 HipiApi 中增加：
  system: SystemApi
```

在 `src/renderer/src/env.d.ts` 中确保类型声明同步（其已引用 `HipiApi`）。

- [ ] **Step 3: Run test & type check**

Run: `npm run typecheck 2>/dev/null || npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit changes**

```bash
git add src/preload/index.ts src/preload/index.d.ts src/renderer/src/env.d.ts
git commit -m "feat(preload): 暴露 system.openExternal 接口及类型定义"
```

---

### Task 4: 渲染层超链接组件渲染、交互与视觉样式优化

**Files:**
- Modify: `src/renderer/src/components/chat/MessageItem.tsx`
- Modify: `src/renderer/src/index.css`
- Test: `src/renderer/src/components/chat/__tests__/MessageItem.test.tsx`

**Interfaces:**
- Consumes: `window.hipiApi.system.openExternal`
- Produces: `MarkdownLink` component and custom ReactMarkdown `a` handler

- [ ] **Step 1: Write unit test for `MarkdownLink` and `MessageItem` link rendering**

创建 `src/renderer/src/components/chat/__tests__/MessageItem.test.tsx`：
```tsx
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
    const originalHipiApi = (window as any).hipiApi

    ;(window as any).hipiApi = {
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

    ;(window as any).hipiApi = originalHipiApi
  })

  it('handleLinkClick falls back to window.open if hipiApi is absent', () => {
    const preventDefault = vi.fn()
    const mockWindowOpen = vi.fn()
    const originalHipiApi = (window as any).hipiApi
    const originalWindowOpen = window.open

    delete (window as any).hipiApi
    window.open = mockWindowOpen

    const mockEvent = {
      preventDefault
    } as unknown as React.MouseEvent<HTMLAnchorElement>

    handleLinkClick(mockEvent, 'https://fallback.com')

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(mockWindowOpen).toHaveBeenCalledWith('https://fallback.com', '_blank', 'noopener,noreferrer')

    ;(window as any).hipiApi = originalHipiApi
    window.open = originalWindowOpen
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/chat/__tests__/MessageItem.test.tsx`
Expected: FAIL with "MarkdownLink is not exported from ../MessageItem"

- [ ] **Step 3: Implement `handleLinkClick`, `MarkdownLink`, and configure in `MessageItem.tsx`**

在 `src/renderer/src/components/chat/MessageItem.tsx` 中：
导出 `handleLinkClick` 与 `MarkdownLink`：
```tsx
export function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>, href?: string) {
  e.preventDefault()
  if (!href) return
  if (typeof window !== 'undefined' && window.hipiApi?.system?.openExternal) {
    window.hipiApi.system.openExternal(href)
  } else if (typeof window !== 'undefined') {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}

export const MarkdownLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({
  href,
  children,
  ...props
}) => {
  return (
    <a
      href={href}
      onClick={(e) => handleLinkClick(e, href)}
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

在 `MessageItem` 的 `ReactMarkdown` 的 `components` 配置中增加 `a: MarkdownLink`：
```tsx
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre({ children, ...props }) {
                  return <CodeBlock {...props}>{children}</CodeBlock>
                },
                a: MarkdownLink
              }}
            >
              {message.content}
            </ReactMarkdown>
```

- [ ] **Step 4: Update CSS fallback in `src/renderer/src/index.css`**

在 `src/renderer/src/index.css` 的 Markdown styling overrides 部分追加：
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

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/chat/__tests__/MessageItem.test.tsx`
Expected: PASS (4 passed)

- [ ] **Step 6: Commit changes**

```bash
git add src/renderer/src/components/chat/MessageItem.tsx src/renderer/src/index.css src/renderer/src/components/chat/__tests__/MessageItem.test.tsx
git commit -m "feat(chat): 优化 AI 回答超链接高亮样式并使用系统浏览器打开"
```

---

### Task 5: 全量回归测试与集成验证

**Files:**
- None (Verification step)

- [ ] **Step 1: Run full Vitest test suite**

Run: `npm test`
Expected: All 12 test files passed (53 + 4 + 4 = 61 tests passed)

- [ ] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run build smoke test**

Run: `npm run build`
Expected: Build successfully completes without bundle errors

- [ ] **Step 4: Verify git status is clean**

Run: `git status`
Expected: Working tree clean
