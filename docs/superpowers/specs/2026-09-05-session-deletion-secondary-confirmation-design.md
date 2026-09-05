# Design Spec: Session Deletion Secondary Confirmation Dialog

## 1. Problem Statement & Motivation
Currently, when a user clicks the delete (trash) icon on a session in the sidebar, the application immediately invokes the main process IPC `session:delete`, which calls `fs.unlinkSync(filePath)` to permanently delete the underlying `.jsonl` session file from disk.

Without a secondary confirmation or guard prompt:
- Accidental clicks permanently delete the user's historical session data with zero chance of recovery.
- There is no indication of what is about to be deleted or the irreversibility of the operation.

## 2. Architecture & Component Design

### 2.1 Reusable `ConfirmDialog` Component
Create a reusable modal component at `src/renderer/src/components/common/ConfirmDialog.tsx`.

#### Props Interface
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
```

#### UI & UX Characteristics
- **Theme**: Consistent with HiPi's dark palette (backdrop `bg-black/60 backdrop-blur-sm`, container `#161b22`, border `#30363d`, text `#f0f6fc`).
- **Visual Warning**: Danger variant features an alert warning icon (e.g. `AlertTriangle`) and a red action button (`bg-red-600 hover:bg-red-500 text-white`).
- **Dismiss Interactions**:
  - Clicking the backdrop dismisses the dialog (calls `onCancel`).
  - Clicking the "取消" button or header close button calls `onCancel`.
  - Pressing the `Escape` key while open dismisses the dialog (calls `onCancel`).
  - Clicking the "确认删除" button calls `onConfirm`.
- **Keyboard & Accessibility**: Registers a global `keydown` listener for `Escape` when mounted/open; cleanly unregisters on close/unmount.

### 2.2 Integration Flow in `App.tsx`
1. Add state: `const [sessionPendingDelete, setSessionPendingDelete] = useState<SessionSummary | null>(null)`.
2. When the user clicks the delete button in the sidebar (or any child `SessionItem`):
   - Triggers `setSessionPendingDelete(session)` instead of directly executing physical deletion.
3. Render `ConfirmDialog` at the root level of `App.tsx`:
   - `isOpen={!!sessionPendingDelete}`
   - `title="删除会话"`
   - `confirmText="确认删除"`
   - `confirmVariant="danger"`
   - `message={...}`:
     ```tsx
     <>
       确认删除会话 <span className="font-semibold text-gray-200">「{sessionPendingDelete?.name || '新会话'}」</span> 吗？
       <br />
       <span className="text-red-400/90 text-xs mt-1 block">此操作将永久物理删除本地会话文件，无法恢复。</span>
     </>
     ```
   - `onConfirm`:
     - Calls existing `handleDeleteSession(sessionPendingDelete)`.
     - Clears `sessionPendingDelete(null)`.
   - `onCancel`:
     - Clears `sessionPendingDelete(null)`.

### 2.3 Existing Session Deletion Logic Retention
The underlying `handleDeleteSession` logic remains intact:
- Calls `window.hipiApi.session.delete(session.path)`
- Cleans up `messagesMap` and `streamingMap`
- Unsets `activeSessionId` if it was the currently active session
- Reloads all sessions to update the sidebar

## 3. Edge Cases & Handling
1. **Long Session Name**: Session name is styled with inline boundary truncation or wrapping so it does not overflow the dialog container.
2. **Streaming Session Deletion**: If the session is actively streaming when deleted, the backend `session:delete` handler aborts the runtime, and `handleDeleteSession` cleans up `streamingMap`.
3. **Double Click / Rapid Click**: Once the confirmation dialog opens, clicks on the background are intercepted by the backdrop overlay, preventing duplicate triggers.
4. **Modal Stack**: `ConfirmDialog` uses `z-50` consistent with `SettingsModal`, ensuring it sits properly above the sidebar and main chat views.

## 4. Testing Strategy
1. **Unit Tests for `ConfirmDialog` (`src/renderer/src/components/common/__tests__/ConfirmDialog.test.tsx`)**:
   - Renders nothing when `isOpen` is false.
   - Renders title, message, confirmText, and cancelText when `isOpen` is true.
   - Clicking confirm button calls `onConfirm`.
   - Clicking cancel button calls `onCancel`.
   - Clicking backdrop calls `onCancel`.
   - Pressing `Escape` calls `onCancel`.
   - Danger variant applies red accent styling.
2. **Regression Tests for Sidebar / App**:
   - Ensure existing tests in `SessionItem.test.tsx` pass.
   - Verify sidebar delete button initiates the confirmation flow.
