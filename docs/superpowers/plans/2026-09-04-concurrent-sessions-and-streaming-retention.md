# Multi-Workspace & Multi-Session Concurrent Execution and Streaming State Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable concurrent session execution across different workspaces and within the same workspace, retain streaming state seamlessly during workspace/session switching, and provide real-time running/breathing indicators in the sidebar.

**Architecture:** Transition main process `AgentSessionManager` from a per-workspace runtime to a `(workspacePath, sessionId)`-keyed Session Runtime Pool with LRU eviction protecting active streams. Upgrade IPC event payloads and client calls with `sessionId`. Transform renderer state from monolithic single arrays to session-indexed maps (`messagesMap`, `streamingMap`, `statsMap`), allowing background event digestion without loss.

**Tech Stack:** Electron 35, Node.js 22, TypeScript 5.7, React 19, TailwindCSS, Vitest 3.2, `@earendil-works/pi-coding-agent`.

## Global Constraints

- Never drop streaming events in renderer due to inactive workspace or inactive session.
- Session key format: `${workspacePath}::${sessionId}`.
- Backward compatibility: If `sessionId` is not passed to runtime commands, default to the most recent or active session for that workspace.
- LRU eviction must never dispose an entry that is currently prompting or streaming (`isPrompting || runtime.session.isStreaming`).
- All tests must pass with `npm test`.

---

### Task 1: Protocol & IPC Type Definitions Upgrade

**Files:**
- Modify: `src/main/types.ts`
- Modify: `src/main/sdk/types.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

**Interfaces:**
- Consumes: Existing IPC message signatures.
- Produces:
  - `PiEventPayload: { workspacePath: string; sessionId: string; event: any }`
  - `pi.sendPrompt({ workspacePath: string; sessionId?: string; message: string; images?: string[] })`
  - `pi.abort({ workspacePath: string; sessionId?: string })`
  - `pi.getState({ workspacePath: string; sessionId?: string })`
  - `pi.getMessages({ workspacePath: string; sessionId?: string })`
  - `pi.onEvent(callback: (data: { workspacePath: string; sessionId: string; event: any }) => void)`

- [x] **Step 1: Write type definitions and interface extensions**

Update `src/main/types.ts`, `src/main/sdk/types.ts`, `src/preload/index.ts`, and `src/preload/index.d.ts` to include optional `sessionId` in PI API calls and ensure `pi:event`, `pi:stderr`, `pi:exit` support `sessionId: string`.

- [x] **Step 2: Run type check & build test**

Run: `npx tsc --noEmit`
Expected: PASS (or minor expected call-site updates)

- [x] **Step 3: Commit**

```bash
git add src/main/types.ts src/main/sdk/types.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat(ipc): upgrade IPC contracts with sessionId support"
```

---

### Task 2: Multi-Session Concurrent Runtime Pool & LRU in AgentSessionManager

**Files:**
- Modify: `src/main/sdk/agent-session-manager.ts`
- Modify: `src/main/sdk/__tests__/agent-session-manager.test.ts`

**Interfaces:**
- Consumes: `@earendil-works/pi-coding-agent`, `SessionManager`, `ModelRuntime`.
- Produces:
  - `AgentSessionManager.getOrCreateEntry(workspacePath: string, sessionId?: string, sessionPath?: string): Promise<SessionRuntimeEntry>`
  - `AgentSessionManager.prompt(workspacePath: string, message: string, images?: string[], sessionId?: string): Promise<void>`
  - `AgentSessionManager.abort(workspacePath: string, sessionId?: string): Promise<boolean>`
  - `AgentSessionManager.stopSession(workspacePath: string, sessionId: string): void`
  - `AgentSessionManager.stopWorkspace(workspacePath: string): void`
  - `AgentSessionManager.onEvent(callback: (data: { workspacePath: string; sessionId: string; event: any }) => void)`

- [x] **Step 1: Write unit tests for multi-session concurrency & stream-safe LRU eviction**

In `src/main/sdk/__tests__/agent-session-manager.test.ts`:
- Test: "runs prompts in two separate sessions of the same workspace concurrently"
- Test: "runs prompts across different workspaces concurrently"
- Test: "LRU eviction skips sessions that are currently prompting or streaming"
- Test: "emits events with precise sessionId"

- [x] **Step 2: Run tests to verify failure**

Run: `npx vitest run src/main/sdk/__tests__/agent-session-manager.test.ts`
Expected: FAIL due to lack of multi-session support.

- [x] **Step 3: Implement multi-session pool in `AgentSessionManager`**

- Refactor `entries` to map `sessionKey: `${workspacePath}::${sessionId}``.
- Maintain a workspace default session mapping for fallback when `sessionId` is not provided.
- When opening an existing session file (`sessionPath`), initialize `SessionManager.open(sessionPath, normalized)`.
- When creating a new session, create a fresh runtime and extract its `sessionId`.
- In `pruneEntriesIfNecessary`, skip entries where `entry.isPrompting || entry.runtime.session.isStreaming`.
- In `emitEvent`, pass both `workspacePath` and `entry.sessionId`.

- [x] **Step 4: Run unit tests to verify pass**

Run: `npx vitest run src/main/sdk/__tests__/agent-session-manager.test.ts`
Expected: PASS (all tests pass).

- [x] **Step 5: Commit**

```bash
git add src/main/sdk/agent-session-manager.ts src/main/sdk/__tests__/agent-session-manager.test.ts
git commit -m "feat(sdk): support concurrent session runtime pool and stream-protected LRU eviction"
```

---

### Task 3: IPC Handlers & Session Lifecycle Integration

**Files:**
- Modify: `src/main/ipc/register-handlers.ts`
- Modify: `src/main/session/session-scanner.ts`

**Interfaces:**
- Consumes: `AgentSessionManager`, `SessionScanner`.
- Produces:
  - Updated IPC handler registrations accepting `{ workspacePath, sessionId, ... }`.
  - On `session:delete`, abort and dispose the session runtime in `AgentSessionManager`.

- [x] **Step 1: Update IPC handlers in `register-handlers.ts`**

- Forward `{ workspacePath, sessionId, event }` in `sessionManager.onEvent`.
- Update `pi:send-prompt`, `pi:abort`, `pi:get-state`, `pi:get-messages`, `pi:set-model`, `pi:set-thinking-level` to pass `sessionId` to `sessionManager`.
- Update `session:delete` to also call `sessionManager.stopSession(workspacePath, sessionId)` if active.

- [x] **Step 2: Run tests and verify build**

Run: `npm test`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add src/main/ipc/register-handlers.ts
git commit -m "feat(ipc): route session-scoped commands and events in IPC handlers"
```

---

### Task 4: Renderer State Pooling & Streaming Retention in `App.tsx`

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/types/index.ts`

**Interfaces:**
- Consumes: `window.hipiApi.pi.onEvent`, `window.hipiApi.pi.sendPrompt`.
- Produces:
  - `messagesMap: Record<string, ChatMessage[]>`
  - `streamingMap: Record<string, boolean>`
  - `statsMap: Record<string, { tokens?: number; cost?: number }>`
  - Continuous streaming state ingestion without data loss when switching sessions or workspaces.

- [x] **Step 1: Refactor state in `App.tsx` to state dictionaries**

- Replace single `messages`, `isStreaming`, `sessionStats` with `messagesMap`, `streamingMap`, `statsMap`.
- Compute active display message list: `const activeMessages = (activeSessionId && messagesMap[activeSessionId]) || []`.
- Compute active streaming state: `const activeIsStreaming = !!(activeSessionId && streamingMap[activeSessionId])`.
- Update `onEvent` listener:
  - Extract `sessionId = data.sessionId || activeSessionId`.
  - If event is `turn_start` / `agent_start`, set `streamingMap[sessionId] = true`.
  - If event is `turn_end` / `agent_end` / `agent_settled`, set `streamingMap[sessionId] = false`.
  - Apply message delta / updates into `messagesMap[sessionId]`.
- In `handleSelectSession`:
  - If `messagesMap[session.id]` exists in memory, keep it immediately; otherwise load from file and populate `messagesMap[session.id]`.
  - No clearing or flicker when switching back and forth!

- [x] **Step 2: Verify prompt sending with active session**

- In `handleSendPrompt`, pass `{ workspacePath: activeWorkspace.path, sessionId: activeSessionId, message: messageText }`.

- [x] **Step 3: Run Vitest & verify existing tests**

Run: `npm test`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/types/index.ts
git commit -m "feat(renderer): pool chat messages and streaming state per session"
```

---

### Task 5: Sidebar Real-Time Running / Breathing Indicators

**Files:**
- Modify: `src/renderer/src/components/sidebar/SessionItem.tsx`
- Modify: `src/renderer/src/components/sidebar/WorkspaceGroup.tsx`
- Modify: `src/renderer/src/components/sidebar/Sidebar.tsx`
- Create: `src/renderer/src/components/sidebar/__tests__/SessionItem.test.tsx`

**Interfaces:**
- Consumes: `streamingMap: Record<string, boolean>`.
- Produces:
  - `SessionItem` prop `isStreaming?: boolean`: shows a subtle cyan/green breathing pulsating dot or spinning indicator when true.
  - `WorkspaceGroup` prop `isStreaming?: boolean`: shows an active running badge/dot when any session in the workspace is streaming.

- [x] **Step 1: Write unit tests for `SessionItem` running indicator**

Create `src/renderer/src/components/sidebar/__tests__/SessionItem.test.tsx`:
- Test: renders session item with normal icon when not streaming.
- Test: renders streaming breathing indicator when `isStreaming` is true.

- [x] **Step 2: Run test to verify failure**

Run: `npx vitest run src/renderer/src/components/sidebar/__tests__/SessionItem.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement streaming visual indicator in `SessionItem` and `WorkspaceGroup`**

- In `SessionItem.tsx`: add `isStreaming?: boolean` prop. If true, render a breathing indicator (e.g. `<span className="relative flex h-2 w-2 mr-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span></span>` or spinner).
- In `WorkspaceGroup.tsx`: compute `hasActiveSessionStreaming = sessions.some(s => streamingMap[s.id])`. Render a mini status dot next to the folder icon.
- Pass `streamingMap` down through `Sidebar.tsx`.

- [x] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/renderer/src/components/sidebar/__tests__/SessionItem.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/renderer/src/components/sidebar/ src/renderer/src/App.tsx
git commit -m "feat(ui): add real-time running and breathing indicators to sidebar"
```

---

### Task 6: Comprehensive Verification & Regression Testing

**Files:**
- Run all test suites across main, preload, and renderer.

- [ ] **Step 1: Execute test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Type check and production build verification**

Run: `npx tsc --noEmit && npm run build`
Expected: Clean build without typescript or bundling errors.

- [ ] **Step 3: Commit and final clean check**

```bash
git status
```
