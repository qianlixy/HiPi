# Design Spec: Multi-Workspace & Multi-Session Concurrent Execution and Streaming State Retention

## 1. Problem Statement & Motivation
In HiPi, the current architecture operates on a single active session model with two main limitations:
1. **Cross-workspace stream loss**: When a user triggers a prompt in Workspace A and switches to Workspace B, incremental events for Workspace A are discarded in the renderer because `workspacePath !== activeWorkspace.path`. Returning to Workspace A loses the streaming experience and real-time outputs.
2. **Single session concurrency limit**: Each workspace maintains only one `PiRpcClient`/`AgentSessionRuntime` instance in the main process, switching sessions serially. Users cannot execute concurrent tasks within the same project (e.g., refactoring code in session 1 while asking about an API in session 2).
3. **Lack of background execution visibility**: The sidebar provides no visual indicator when background sessions or workspaces are actively streaming or executing tools.

## 2. Architecture: Session Runtime Pool (Plan A)

### 2.1 Identifier & Key Convention
A session runtime is uniquely keyed by:
`sessionKey = `${workspacePath}::${sessionId}`` (or scoped per workspace and sessionId).

If `sessionId` is omitted or empty in backward-compatible calls, the default session for that workspace is resolved or initialized.

### 2.2 IPC Protocol Upgrades
All session-directed events and invocations will include `sessionId`:

- **Event Push**:
  - `pi:event`: `{ workspacePath: string, sessionId: string, event: any }`
  - `pi:stderr`: `{ workspacePath: string, sessionId: string, text: string }`
  - `pi:exit`: `{ workspacePath: string, sessionId: string, code: number | null, signal: string | null }`

- **Renderer Invocations**:
  - `pi:send-prompt`: `{ workspacePath: string, sessionId: string, message: string, images?: string[] }`
  - `pi:abort`: `{ workspacePath: string, sessionId: string }`
  - `pi:get-state`: `{ workspacePath: string, sessionId?: string }`
  - `pi:get-messages`: `{ workspacePath: string, sessionId?: string }`
  - `pi:set-model`: `{ workspacePath: string, sessionId?: string, provider: string, modelId: string }`
  - `pi:set-thinking-level`: `{ workspacePath: string, sessionId?: string, level: string }`
  - `pi:new-session`: `{ workspacePath: string }` -> returns `{ sessionId: string, sessionPath: string }`
  - `pi:switch-session`: `{ workspacePath: string, sessionPath: string }` -> loads/activates runtime for session

### 2.3 Main Process: `AgentSessionManager`
- Store runtimes in `entries: Map<string, SessionRuntimeEntry>` where key is `sessionKey`.
- `SessionRuntimeEntry`:
  ```typescript
  interface SessionRuntimeEntry {
    workspacePath: string
    sessionId: string
    runtime: AgentSessionRuntime
    unsubscribe: () => void
    lastActiveAt: number
    isPrompting?: boolean
  }
  ```
- **LRU Eviction & Concurrency Limit**:
  - Configurable `maxEntries` (default 10).
  - When `entries.size >= maxEntries`, find the oldest entry where `!entry.isPrompting && !entry.runtime.session.isStreaming`.
  - Disposing an entry cleanly calls `entry.unsubscribe()` and `entry.runtime.dispose()`.
  - Re-opening a closed session uses `SessionManager.open(sessionPath, workspacePath)` on demand without data loss.

### 2.4 Renderer State Management: State Pooling
- **State Dictionaries**:
  - `messagesMap: Record<string, ChatMessage[]>` keyed by `sessionId`.
  - `streamingMap: Record<string, boolean>` keyed by `sessionId`.
  - `statsMap: Record<string, { tokens?: number; cost?: number }>` keyed by `sessionId`.
- **Background Event Ingestion**:
  - When `pi:event` is received with `{ workspacePath, sessionId, event }`:
    - Updates `messagesMap[sessionId]` incrementally regardless of active workspace/session.
    - Sets `streamingMap[sessionId]` based on `turn_start`, `agent_start`, `turn_end`, `agent_settled`.
  - Active chat views immediately display from `messagesMap[activeSessionId]` without flicker or message clearing during background activity.

### 2.5 UI Indicators: Sidebar Running Animations
- `SessionItem`:
  - Receives `isStreaming: boolean`.
  - Renders a subtle pulse/breathing indicator (e.g., animate-pulse dot or Loader spinner) when `isStreaming` is true.
- `WorkspaceGroup`:
  - Computes `isAnySessionStreaming = sessions.some(s => streamingMap[s.id])`.
  - Shows a mini running dot on the workspace header when any session under it is active.

## 3. Error Handling & Edge Cases
1. **Process crash or abrupt exit**: If a session runtime throws during prompt, `isPrompting` and `streamingMap[sessionId]` are reset to false with user-friendly error banners.
2. **Session deletion while running**: If a session is deleted, any active runtime for that session is aborted and disposed before file removal.
3. **Rapid session switching**: Switching sessions does not abort active background sessions.

## 4. Testing Strategy
1. **Unit Tests (AgentSessionManager)**:
   - Concurrent session execution in same workspace.
   - Cross-workspace concurrent execution.
   - LRU eviction: active streaming sessions are spared from eviction.
   - Session reuse and on-demand opening from disk.
2. **Unit Tests (Renderer / State)**:
   - Background event dispatch updating `messagesMap` for inactive sessions.
   - Sidebar components rendering running/breathing indicators appropriately.
