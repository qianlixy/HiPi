# Session Deletion Secondary Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secondary confirmation dialog when deleting a session from the sidebar to prevent accidental and irreversible physical deletion of `.jsonl` session files.

**Architecture:** Create a reusable `ConfirmDialog` modal component matching the app's dark theme palette. In `App.tsx`, introduce a `sessionPendingDelete` state: clicking delete on a sidebar session triggers this state instead of directly executing disk deletion; the user must confirm in the dialog to proceed with physical deletion.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Vitest.

## Global Constraints

- Design matches HiPi dark theme (`#161b22`, `#30363d`, `text-gray-200`, danger red `bg-red-600`).
- Dialog closes on `Escape` key, backdrop click, or "取消" button click without deleting.
- Clicking "确认删除" triggers deletion and closes the dialog.
- Existing session cleanup (messages, streaming state, active session reset, list reloading) remains unchanged.

---

### Task 1: Create Reusable `ConfirmDialog` Component & Unit Tests

**Files:**
- Create: `src/renderer/src/components/common/ConfirmDialog.tsx`
- Test: `src/renderer/src/components/common/__tests__/ConfirmDialog.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export interface ConfirmDialogProps {
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmText?: string
    cancelText?: string
    confirmVariant?: 'danger' | 'primary'
    onConfirm: () => void
    onCancel: () => void
  }
  export const ConfirmDialog: React.FC<ConfirmDialogProps>
  ```

- [ ] **Step 1: Write the failing unit tests for `ConfirmDialog`**

```tsx
// src/renderer/src/components/common/__tests__/ConfirmDialog.test.tsx
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/common/__tests__/ConfirmDialog.test.tsx`
Expected: FAIL (Cannot find module `../ConfirmDialog`)

- [ ] **Step 3: Implement `ConfirmDialog` component**

```tsx
// src/renderer/src/components/common/ConfirmDialog.tsx
import React, { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'primary',
  onConfirm,
  onCancel
}) => {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
      data-testid="confirm-dialog-backdrop"
    >
      <div
        className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="confirm-dialog-container"
      >
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#30363d] flex items-center justify-between flex-shrink-0 bg-[#0d1117]/60">
          <div className="flex items-center space-x-2">
            {confirmVariant === 'danger' && (
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span className="font-semibold text-sm text-gray-100">{title}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 text-xs text-gray-300 leading-relaxed">
          {message}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#30363d] bg-[#0d1117]/40 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] text-xs text-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ${
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/common/__tests__/ConfirmDialog.test.tsx`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/common/ConfirmDialog.tsx src/renderer/src/components/common/__tests__/ConfirmDialog.test.tsx
git commit -m "feat(ui): add reusable ConfirmDialog component"
```

---

### Task 2: Integrate `ConfirmDialog` with Session Deletion in `App.tsx`

**Files:**
- Modify: `src/renderer/src/App.tsx:470-495, 630-650, 715-730`

**Interfaces:**
- Consumes: `ConfirmDialog` from `src/renderer/src/components/common/ConfirmDialog`
- State:
  - `const [sessionPendingDelete, setSessionPendingDelete] = useState<SessionSummary | null>(null)`

- [ ] **Step 1: Update `App.tsx` to handle secondary confirmation**

In `src/renderer/src/App.tsx`:
1. Import `ConfirmDialog`:
```tsx
import { ConfirmDialog } from './components/common/ConfirmDialog'
```
2. Add state:
```tsx
const [sessionPendingDelete, setSessionPendingDelete] = useState<SessionSummary | null>(null)
```
3. Update session deletion handlers:
```tsx
  const handleRequestDeleteSession = (session: SessionSummary) => {
    setSessionPendingDelete(session)
  }

  const handleConfirmDeleteSession = async () => {
    if (!sessionPendingDelete) return
    const session = sessionPendingDelete
    setSessionPendingDelete(null)
    await handleDeleteSession(session)
  }

  const handleCancelDeleteSession = () => {
    setSessionPendingDelete(null)
  }
```
4. Pass `onRequestDeleteSession` to `<Sidebar />`:
```tsx
        onDeleteSession={handleRequestDeleteSession}
```
5. Render `<ConfirmDialog />` in `App.tsx` root:
```tsx
      <ConfirmDialog
        isOpen={!!sessionPendingDelete}
        title="删除会话"
        confirmText="确认删除"
        confirmVariant="danger"
        message={
          sessionPendingDelete ? (
            <div>
              <p>
                确认删除会话 <span className="font-semibold text-gray-200">「{sessionPendingDelete.name || '新会话'}」</span> 吗？
              </p>
              <p className="text-red-400/90 text-xs mt-2">
                此操作将永久物理删除本地会话文件，无法恢复。
              </p>
            </div>
          ) : null
        }
        onConfirm={handleConfirmDeleteSession}
        onCancel={handleCancelDeleteSession}
      />
```

- [ ] **Step 2: Run all tests to verify no regressions**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat(session): add secondary confirmation dialog before session deletion"
```

---

### Task 3: Comprehensive Verification & Build

**Files:**
- Verify: Full test suite and production build

- [ ] **Step 1: Run full Vitest test suite**

Run: `npm test`
Expected: 7 test files passed, all tests pass without errors.

- [ ] **Step 2: Run build to verify TypeScript compilation and Vite bundling**

Run: `npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Final git status check**

Run: `git status`
Expected: Clean working tree.
